import { openAsBlob } from "node:fs";
import { stat } from "node:fs/promises";
import { BlobReader, ZipReader } from "@zip.js/zip.js";
import * as zipErrors from "@zip.js/zip.js";
import { readPassword } from "../lib/system-backup/password-input.mjs";

const file = process.argv[2];
if (!file || process.argv.length !== 3) {
  console.error(
    'Lokasi file ZIP belum diisi. Gunakan: node scripts/verify-system-backup-zip.mjs "C:\\lokasi\\backup.zip"',
  );
  process.exit(1);
}

let reader;
let stage = "read",
  entryNumber = 0;
try {
  const metadata = await stat(file);
  if (!metadata.isFile()) throw new Error("ZIP_FILE_INVALID");
  stage = "password";
  const password = await readPassword();
  if (!password) throw new Error("Kata sandi wajib diisi.");
  stage = "read";
  reader = new ZipReader(new BlobReader(await openAsBlob(file)));
  const entries = await reader.getEntries();
  if (!entries.length || entries.some((entry) => !entry.encrypted || entry.zipCrypto))
    throw new Error("File bukan ZIP backup AES yang sesuai.");
  for (const entry of entries) {
    stage = "decrypt";
    entryNumber++;
    await entry.getData(new WritableStream({ write() {} }), {
      password,
      checkSignature: true,
    });
  }
  console.log(
    `ZIP valid: kata sandi diterima dan integritas ${entries.length} entri berhasil diperiksa. Tidak ada file yang diekstrak.`,
  );
} catch (error) {
  const libraryCode = Object.entries(zipErrors).find(
    ([key, value]) => key.startsWith("ERR_") && value === error.message,
  )?.[0];
  const code =
    libraryCode ||
    (/signature|authentication/i.test(error.message)
      ? "ZIP_INTEGRITY_FAILED"
      : error.code === "ENOENT"
        ? "ZIP_FILE_NOT_FOUND"
        : error.name === "NotReadableError"
          ? "ZIP_READ_FAILED"
          : "ZIP_CHECK_FAILED");
  console.error(
    code === "ZIP_FILE_NOT_FOUND"
      ? "File ZIP tidak ditemukan. Periksa nama file terbaru dan lokasi foldernya."
      : error.message === "Invalid password"
        ? "ZIP menolak kata sandi yang dimasukkan. Gunakan kata sandi saat backup ini dibuat, bukan kata sandi akun login atau backup lain."
        : "ZIP belum dapat diverifikasi. Periksa lokasi file, kata sandi, dan kelengkapan unduhan.",
  );
  console.error(
    `Kode: ${code}. Tahap: ${stage}. Entri: ${entryNumber}. Tipe: ${error.name || "Error"}.`,
  );
  process.exitCode = 1;
} finally {
  await reader?.close();
}
