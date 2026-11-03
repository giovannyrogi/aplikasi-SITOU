import { randomUUID, createHash } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { fileTypeFromBuffer } from "file-type";
import pool from "@/lib/dbConfig";
import { withTransaction } from "@/lib/dbTransaction";
import { writeAudit } from "@/lib/audit";
import { scanUploadBuffer } from "@/lib/files/malwareScanner";
import { resolvePrivateObjectPath } from "@/lib/files/localLifecycle.mjs";
import { PDF_MAX_BYTES, pdfError } from "./pdf-process.mjs";

function admin(actor) {
  if (actor.role_code !== "superadmin") throw pdfError("FORBIDDEN", "Khusus Admin SITOU.", 403);
}
export async function uploadHolidayPdf(actor, file, year, requestKey, requestId) {
  admin(actor);
  if (!file || typeof file.arrayBuffer !== "function" || file.size < 1 || file.size > PDF_MAX_BYTES)
    throw pdfError("PDF_SIZE_INVALID", "Pilih satu PDF maksimal 10 MB.");
  const buffer = Buffer.from(await file.arrayBuffer());
  if (
    buffer.length > PDF_MAX_BYTES ||
    (await fileTypeFromBuffer(buffer))?.mime !== "application/pdf" ||
    !buffer.subarray(0, 8).toString().startsWith("%PDF-")
  )
    throw pdfError("PDF_INVALID", "File harus berupa PDF yang valid.");
  const digest = createHash("sha256").update(buffer).digest("hex");
  // Scan before any parsing. Production fails closed if scanner is unavailable.
  const scan = await scanUploadBuffer(buffer);
  const key = `platform/holiday_catalogs/${year}/${randomUUID()}.pdf`;
  const destination = resolvePrivateObjectPath(key);
  await mkdir(path.dirname(destination), { recursive: true });
  let written = false,
    keep = false;
  try {
    const result = await withTransaction(async (db) => {
      await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,70))", [String(actor.id)]);
      const old = (
        await db.query(
          `SELECT i.id,i.year,f.sha256 FROM holiday_pdf_imports i JOIN stored_files f ON f.id=i.file_id WHERE i.actor_user_id=$1 AND i.request_key=$2`,
          [actor.id, requestKey],
        )
      ).rows[0];
      if (old) {
        if (old.year !== year || old.sha256 !== digest)
          throw pdfError("REQUEST_CONFLICT", "Permintaan yang sama memuat dokumen berbeda.", 409);
        return { id: old.id };
      }
      const active = +(
        await db.query(
          "SELECT count(*) FROM holiday_pdf_imports WHERE actor_user_id=$1 AND status IN ('queued','running')",
          [actor.id],
        )
      ).rows[0].count;
      if (active >= 2)
        throw pdfError("PDF_QUEUE_FULL", "Tunggu pembacaan dokumen sebelumnya selesai.", 409);
      await writeFile(destination, buffer, { flag: "wx", mode: 0o600 });
      written = true;
      const stored = (
        await db.query(
          `INSERT INTO stored_files(organization_id,ownership_scope,storage_provider,object_key,original_name,mime_type,size_bytes,sha256,category,uploaded_by_user_id,lifecycle_status,malware_scan_status,malware_scanned_at,malware_scan_engine)
        VALUES(NULL,'platform','local_private',$1,$2,'application/pdf',$3,$4,'holiday_catalog_source',$5,'active',$6,now(),$7) RETURNING id`,
          [
            key,
            path
              .basename(String(file.name || "SKB.pdf"))
              .replace(/[\x00-\x1f\\/]/g, "_")
              .slice(0, 255),
            buffer.length,
            digest,
            actor.id,
            scan.status,
            scan.engine,
          ],
        )
      ).rows[0];
      const id = randomUUID();
      await db.query(
        "INSERT INTO holiday_pdf_imports(id,actor_user_id,request_key,year,file_id) VALUES($1,$2,$3,$4,$5)",
        [id, actor.id, requestKey, year, stored.id],
      );
      await writeAudit(db, {
        actorUserId: actor.id,
        action: "holiday_catalog.pdf_upload",
        entityType: "holiday_pdf_import",
        entityId: id,
        requestId,
        afterData: { year, sha256: digest, size: buffer.length },
      });
      return { id };
    });
    keep = written;
    return result;
  } finally {
    if (written && !keep) await unlink(destination).catch(() => {});
  }
}
export async function readHolidayPdfImport(actor, id) {
  admin(actor);
  const row = (
    await pool.query(
      `SELECT i.id,i.year,i.status,i.stage,i.progress,i.attempts,i.parser_version,i.result,i.error_code,i.created_at,i.completed_at,
    f.original_name,f.size_bytes,f.sha256 FROM holiday_pdf_imports i JOIN stored_files f ON f.id=i.file_id WHERE i.id=$1`,
      [id],
    )
  ).rows[0];
  if (!row) throw pdfError("NOT_FOUND", "Pembacaan dokumen tidak ditemukan.", 404);
  return row;
}
