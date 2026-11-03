import { randomUUID, createHash } from "node:crypto";
import { mkdtemp, readFile, rm, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { setTimeout as delay } from "node:timers/promises";
import sharp from "sharp";
import {
  executable,
  inspectPdf,
  pdfError,
  runProgram,
  PDF_PARSER_VERSION,
} from "./pdf-process.mjs";
import { parseHolidayPages, tsvWords } from "./pdf-parser.mjs";
import { prepareOcrImage } from "./pdf-image.mjs";
import { inspectPrivateStoragePath } from "../storage-maintenance/shared.mjs";
import { scanUploadBuffer } from "../files/malwareScanner.js";
import { purgeDeletedHolidayPdf } from "./deletion-worker.mjs";

async function processJob(pool, root, job, shutdownSignal) {
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 300000);
  const stop = () => controller.abort();
  shutdownSignal?.addEventListener("abort", stop, { once: true });
  const heartbeat = setInterval(
    () =>
      pool
        .query(
          "UPDATE holiday_pdf_imports SET heartbeat_at=now() WHERE id=$1 AND worker_token=$2 AND status='running'",
          [job.id, job.worker_token],
        )
        .catch(() => controller.abort()),
    10000,
  );
  let work;
  const progress = async (stage, value) => {
    const r = await pool.query(
      "UPDATE holiday_pdf_imports SET stage=$3,progress=$4,heartbeat_at=now() WHERE id=$1 AND worker_token=$2 AND status='running'",
      [job.id, job.worker_token, stage, value],
    );
    if (!r.rowCount) throw pdfError("WORKER_LEASE_LOST", "Pekerjaan telah diambil ulang.", 503);
  };
  try {
    await progress("checking", 5);
    const file = (
      await pool.query(
        "SELECT * FROM stored_files WHERE id=$1 AND ownership_scope='platform' AND category='holiday_catalog_source' AND deleted_at IS NULL",
        [job.file_id],
      )
    ).rows[0];
    if (!file) throw pdfError("PDF_MISSING", "Dokumen sumber tidak tersedia.");
    const physical = await inspectPrivateStoragePath(root, file.object_key);
    if (!physical.valid || !physical.exists)
      throw pdfError("PDF_MISSING", "Dokumen sumber tidak tersedia.");
    const buffer = await readFile(physical.absolutePath);
    if (createHash("sha256").update(buffer).digest("hex") !== file.sha256.trim())
      throw pdfError("PDF_INTEGRITY", "Dokumen sumber berbeda dari unggahan.");
    await scanUploadBuffer(buffer);
    const info = await runProgram(executable("pdfinfo"), [physical.absolutePath], {
      signal: controller.signal,
    });
    if (/Encrypted:\s+yes/i.test(info.stdout))
      throw pdfError("PDF_ENCRYPTED", "PDF terkunci tidak didukung.");
    const inspected = await inspectPdf(physical.absolutePath, controller.signal);
    // Poppler emits coordinates without executing PDF actions. Decode only XML text entities.
    const textOutput = await runProgram(
      executable("pdftotext"),
      ["-bbox-layout", physical.absolutePath, "-"],
      { signal: controller.signal, maxBytes: 4 * 1024 * 1024 },
    );
    const decode = (text) =>
      text
        .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, "&");
    const textPages = [...textOutput.stdout.matchAll(/<page\s[^>]*>([\s\S]*?)<\/page>/g)];
    for (const [index, match] of textPages.entries()) {
      if (!inspected.pages[index]) continue;
      inspected.pages[index].words = [
        ...match[1].matchAll(
          /<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([\s\S]*?)<\/word>/g,
        ),
      ].map((m) => ({
        x: +m[1],
        y: +m[2],
        width: +m[3] - m[1],
        height: +m[4] - m[2],
        text: decode(m[5]),
        confidence: 100,
      }));
    }
    work = await mkdtemp(path.join(tmpdir(), "sitou-skb-"));
    for (const page of inspected.pages) {
      await progress("reading", 10 + Math.floor((75 * (page.page - 1)) / inspected.pages.length));
      // Sparse text layers are insufficient evidence for a scanned appendix.
      if (page.words.reduce((n, w) => n + w.text.length, 0) >= 120) {
        page.method = "text";
        continue;
      }
      const prefix = path.join(work, `page-${page.page}`);
      await runProgram(
        executable("pdftoppm"),
        [
          "-f",
          String(page.page),
          "-l",
          String(page.page),
          "-singlefile",
          "-r",
          "300",
          "-scale-to",
          String(Math.floor(Math.min(4000, (Math.max(page.width, page.height) * 300) / 72))),
          "-gray",
          "-png",
          physical.absolutePath,
          prefix,
        ],
        { signal: controller.signal },
      );
      const image = `${prefix}.png`;
      const imageStat = await stat(image);
      if (imageStat.size > 32 * 1024 * 1024)
        throw pdfError("PDF_RENDER_LIMIT", "Halaman melebihi batas pembacaan.");
      const prepared = path.join(work, `ocr-${page.page}.png`);
      let orientation = 0;
      try {
        const detected = await runProgram(
          executable("tesseract"),
          [image, "stdout", "-l", "osd", "--psm", "0"],
          { signal: controller.signal },
        );
        const angle = detected.stdout.match(/Rotate:\s*(90|180|270)\b/),
          confidence = detected.stdout.match(/Orientation confidence:\s*([\d.]+)/);
        if (angle && Number(confidence?.[1] || 0) >= 5) orientation = Number(angle[1]);
      } catch (e) {
        if (e.code !== "PDF_PROCESS_FAILED") throw e;
      }
      const oriented = path.join(work, `oriented-${page.page}.png`);
      if (orientation)
        await sharp(image, { limitInputPixels: 20e6 }).rotate(orientation).toFile(oriented);
      const preparation = await prepareOcrImage(orientation ? oriented : image, prepared);
      const output = await runProgram(
        executable("tesseract"),
        [prepared, "stdout", "-l", "ind+eng", "--psm", "6", "-c", "tessedit_create_tsv=1"],
        { signal: controller.signal },
      );
      page.words = tsvWords(output.stdout);
      page.width = preparation.width;
      page.height = preparation.height;
      page.ocrRotation = orientation;
      page.rules = preparation.rules;
      page.method = "ocr";
      await unlink(image);
      await unlink(prepared);
      if (orientation) await unlink(oriented);
    }
    await progress("preparing", 90);
    const result = parseHolidayPages(inspected.pages, job.year);
    result.pages = inspected.pages.map(({ page, method, width, height }) => ({
      page,
      method,
      width,
      height,
    }));
    const completion = await pool.connect();
    try {
      await completion.query("BEGIN");
      const updated = await completion.query(
        `UPDATE holiday_pdf_imports SET status=$3,stage='done',progress=100,result=$4,parser_version=$5,completed_at=now(),heartbeat_at=now(),error_code=NULL WHERE id=$1 AND worker_token=$2 AND status='running' RETURNING id`,
        [
          job.id,
          job.worker_token,
          result.complete ? "ready" : "incomplete",
          JSON.stringify(result),
          PDF_PARSER_VERSION,
        ],
      );
      if (updated.rowCount)
        await completion.query(
          `INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,'holiday_catalog.pdf_extracted','holiday_pdf_import',$2,$3::jsonb)`,
          [
            job.actor_user_id,
            job.id,
            JSON.stringify({
              complete: result.complete,
              dates: result.days.length,
              parserVersion: PDF_PARSER_VERSION,
            }),
          ],
        );
      await completion.query("COMMIT");
    } catch (e) {
      await completion.query("ROLLBACK");
      throw e;
    } finally {
      completion.release();
    }
  } catch (e) {
    const retry = job.attempts < 3 && (e.status === 503 || controller.signal.aborted);
    await pool.query(
      `UPDATE holiday_pdf_imports SET status=$3,stage='error',error_code=$4,next_attempt_at=now()+interval '30 seconds',completed_at=CASE WHEN $3='failed' THEN now() ELSE NULL END WHERE id=$1 AND worker_token=$2 AND status='running'`,
      [job.id, job.worker_token, retry ? "queued" : "failed", e.code || "PDF_PROCESS_FAILED"],
    );
  } finally {
    clearTimeout(timer);
    clearInterval(heartbeat);
    shutdownSignal?.removeEventListener("abort", stop);
    if (work) await rm(work, { recursive: true, force: true });
  }
}
async function expireUnused(pool, root) {
  const rows = (
    await pool.query(`SELECT f.id,f.object_key FROM stored_files f WHERE f.ownership_scope='platform' AND f.category='holiday_catalog_source' AND f.created_at<now()-interval '24 hours' AND f.content_purged_at IS NULL
    AND NOT EXISTS(SELECT 1 FROM holiday_catalogs c WHERE c.source_file_id=f.id)
    AND NOT EXISTS(SELECT 1 FROM holiday_pdf_imports i WHERE i.file_id=f.id AND i.status='running')
    AND NOT EXISTS(SELECT 1 FROM holiday_pdf_purge_jobs p WHERE p.file_id=f.id)`)
  ).rows;
  for (const f of rows) {
    const db = await pool.connect();
    try {
      await db.query("BEGIN");
      // Same import → file lock order as catalog save; never purge a concurrent save.
      const jobs = await db.query(
        "SELECT id,status FROM holiday_pdf_imports WHERE file_id=$1 FOR UPDATE",
        [f.id],
      );
      if (jobs.rows.some((j) => j.status === "running")) {
        await db.query("ROLLBACK");
        continue;
      }
      await db.query("SELECT id FROM stored_files WHERE id=$1 FOR UPDATE", [f.id]);
      if (
        (await db.query("SELECT 1 FROM holiday_catalogs WHERE source_file_id=$1", [f.id])).rowCount
      ) {
        await db.query("ROLLBACK");
        continue;
      }
      const physical = await inspectPrivateStoragePath(root, f.object_key);
      if (!physical.valid) {
        await db.query("ROLLBACK");
        continue;
      }
      await db.query(
        "UPDATE holiday_pdf_imports SET status='expired',result=NULL,stage='expired' WHERE file_id=$1",
        [f.id],
      );
      await db.query(
        "UPDATE stored_files SET lifecycle_status='deleted',deleted_at=now(),deletion_reason_code='holiday_pdf_expired' WHERE id=$1",
        [f.id],
      );
      await db.query(
        `INSERT INTO audit_logs(action,entity_type,entity_id,after_data) VALUES('holiday_catalog.pdf_expired','stored_file',$1,'{"actor":"system"}'::jsonb)`,
        [String(f.id)],
      );
      await db.query("COMMIT");
      // Expire references before physical deletion; interrupted purges retry safely.
      if (physical.exists) await unlink(physical.absolutePath);
      await pool.query(
        "UPDATE stored_files SET lifecycle_status='purged',content_purged_at=now() WHERE id=$1 AND lifecycle_status='deleted'",
        [f.id],
      );
    } catch (e) {
      await db.query("ROLLBACK");
      throw e;
    } finally {
      db.release();
    }
  }
}
export async function runHolidayPdfWorker(pool, root, { once = false, signal } = {}) {
  let maintenance = 0;
  do {
    await purgeDeletedHolidayPdf(pool, root);
    await pool.query(
      `UPDATE holiday_pdf_imports SET status=CASE WHEN attempts>=3 THEN 'failed' ELSE 'queued' END,error_code='WORKER_INTERRUPTED',worker_token=NULL,next_attempt_at=now() WHERE status='running' AND heartbeat_at<now()-interval '90 seconds'`,
    );
    if (Date.now() - maintenance > 60000) {
      await expireUnused(pool, root);
      maintenance = Date.now();
    }
    const token = randomUUID();
    const job = (
      await pool.query(
        `WITH next AS (SELECT id FROM holiday_pdf_imports WHERE status='queued' AND next_attempt_at<=now() ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1)
      UPDATE holiday_pdf_imports i SET status='running',attempts=attempts+1,worker_token=$1,heartbeat_at=now() FROM next WHERE i.id=next.id RETURNING i.*`,
        [token],
      )
    ).rows[0];
    if (job) await processJob(pool, root, job, signal);
    else if (!once) await delay(2000, undefined, { signal }).catch(() => {});
  } while (!once && !signal?.aborted);
}
