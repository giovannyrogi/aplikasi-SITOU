import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { verifyArchive } from "../lib/system-backup/archive.mjs";

const archivePath = process.argv[2];
const requestedExtract = process.argv.find((value) => value.startsWith("--extract="))?.slice(10);
if (!archivePath) throw new Error("Gunakan: node scripts/verify-system-backup.mjs PAKET [--extract=FOLDER].");

/** Terminal interaktif menyembunyikan ketikan; pipe tetap didukung untuk otomasi aman. */
async function readPassword() {
  if (!process.stdin.isTTY) {
    let value = "";
    for await (const chunk of process.stdin) value += chunk.toString("utf8");
    return value.replace(/[\r\n]+$/, "");
  }
  process.stdout.write("Kata sandi backup: ");
  return new Promise((resolve, reject) => {
    let value = "";
    process.stdin.setRawMode(true);
    process.stdin.resume();
    const finish = (error) => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.off("data", receive);
      process.stdout.write("\n");
      if (error) reject(error); else resolve(value);
    };
    const receive = (buffer) => {
      const chunk = buffer.toString("utf8");
      if (chunk === "\r" || chunk === "\n") finish();
      else if (chunk === "\u0003") finish(new Error("Dibatalkan."));
      else if (chunk === "\u007f" || chunk === "\b") value = value.slice(0, -1);
      else if (!/[\r\n]/.test(chunk) && value.length < 128) value += chunk;
    };
    process.stdin.on("data", receive);
  });
}

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
    const child = spawn(pgRestore, ["--list", path.join(destination, "database.dump")],
      { stdio: ["ignore", "ignore", "pipe"], windowsHide: true });
    child.once("error", reject);
    child.once("close", (code) => code === 0 ? resolve() : reject(new Error("pg_restore tidak dapat membaca dump.")));
  });
  console.log(`Paket valid: ${manifest.organizationCount} organisasi, ${manifest.fileCount} file upload.`);
  if (requestedExtract) console.log(`File diekstrak ke ${destination}. Pulihkan hanya di lingkungan terpisah.`);
} finally {
  if (temporary?.startsWith(path.resolve(os.tmpdir()) + path.sep))
    await rm(temporary, { recursive: true, force: true });
}
