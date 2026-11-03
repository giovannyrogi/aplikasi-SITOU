import dotenv from "dotenv";
import pg from "pg";
import path from "node:path";
import { access, mkdir, writeFile, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { executable, runProgram } from "../lib/holiday-catalogs/pdf-process.mjs";
import { scanUploadBuffer } from "../lib/files/malwareScanner.js";
dotenv.config({
  path:
    process.env.ENV_FILE ||
    (process.env.NODE_ENV === "production" ? ".env.production" : ".env.development"),
  quiet: true,
});
const pool = new pg.Pool({ max: 1 });
try {
  for (const name of ["tesseract", "pdfinfo", "pdftotext", "pdftoppm"]) {
    await runProgram(executable(name), [name === "tesseract" ? "--version" : "-v"]);
    console.log(`${name}: tersedia`);
  }
  const langs = (await runProgram(executable("tesseract"), ["--list-langs"])).stdout;
  if (!/^ind\s*$/m.test(langs) || !/^eng\s*$/m.test(langs) || !/^osd\s*$/m.test(langs))
    throw new Error("Pasang data bahasa ind, eng dan osd.");
  const root = path.resolve(process.env.UPLOAD_ROOT || "uploads");
  await access(root);
  await mkdir(path.join(root, ".tmp"), { recursive: true });
  const probe = path.join(root, ".tmp", `ocr-check-${randomUUID()}`);
  await writeFile(probe, "storage probe", { flag: "wx", mode: 0o600 });
  await unlink(probe);
  await pool.query("SELECT source_file_id,pdf_import_id FROM holiday_catalogs LIMIT 0");
  await pool.query("SELECT id FROM holiday_pdf_imports LIMIT 0");
  await pool.query("SELECT file_id FROM holiday_pdf_purge_jobs LIMIT 0");
  const scan = await scanUploadBuffer(Buffer.from("SITOU OCR preflight benign content"));
  console.log(`Bahasa ind/eng/osd, storage, schema: siap. Scanner: ${scan.status}.`);
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
