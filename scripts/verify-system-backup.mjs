import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { verifyArchive } from "../lib/system-backup/archive.mjs";

const archivePath = process.argv[2];
const requestedExtract = process.argv.find((value) => value.startsWith("--extract="))?.slice(10);
if (!archivePath)
  throw new Error("Gunakan: node scripts/verify-system-backup.mjs PAKET [--extract=FOLDER].");

import { readPassword } from "../lib/system-backup/password-input.mjs";

const password = await readPassword();
if (!password) throw new Error("Kata sandi wajib diisi melalui stdin.");

const temporary = requestedExtract ? null : await mkdtemp(path.join(os.tmpdir(), "sitou-verify-"));
const destination = path.resolve(requestedExtract || temporary);
try {
  const safeArchivePath = path.resolve(archivePath);
  await verifyArchive(safeArchivePath, password);
  const manifest = await verifyArchive(safeArchivePath, password, { extractRoot: destination });
  const pgRestore = process.env.PG_RESTORE_PATH || "pg_restore";
  await new Promise((resolve, reject) => {
    const child = spawn(pgRestore, ["--list", path.join(destination, manifest.databasePath)], {
      stdio: ["ignore", "ignore", "pipe"],
      windowsHide: true,
    });
    child.once("error", reject);
    child.once("close", (code) =>
      code === 0 ? resolve() : reject(new Error("pg_restore tidak dapat membaca dump.")),
    );
  });
  console.log(
    `Paket valid: ${manifest.organizationCount} organisasi, ${manifest.fileCount} file upload, ${manifest.issueCount || 0} file perlu tindak lanjut.`,
  );
  if (manifest.format === 3 && requestedExtract)
    console.log(`Daftar tindak lanjut: ${path.join(destination, "backup-file-issues.json")}`);
  if (requestedExtract)
    console.log(`File diekstrak ke ${destination}. Pulihkan hanya di lingkungan terpisah.`);
} finally {
  if (temporary?.startsWith(path.resolve(os.tmpdir()) + path.sep))
    await rm(temporary, { recursive: true, force: true });
}
