import { createHash } from "node:crypto";
import { createReadStream, createWriteStream, openAsBlob } from "node:fs";
import { lstat, rm } from "node:fs/promises";
import { Writable } from "node:stream";
import { BlobReader, ZipWriter } from "@zip.js/zip.js";

export async function hashFile(filePath) {
  const hash = createHash("sha256");
  let size = 0;
  for await (const chunk of createReadStream(filePath)) {
    hash.update(chunk);
    size += chunk.length;
  }
  return { sha256: hash.digest("hex"), size };
}

/** ZIP AES-256 ditulis bertahap dengan format yang kompatibel dengan alat ekstraksi. */
async function createZip(destination, password, entries, onProgress) {
  const output = createWriteStream(destination, { flags: "wx", mode: 0o600 });
  const encrypted = Boolean(password);
  const writer = new ZipWriter(
    Writable.toWeb(output),
    encrypted ? { password, encryptionStrength: 3, level: 1 } : { level: 1 },
  );
  try {
    for (const [index, entry] of entries.entries()) {
      if (
        !entry.name ||
        entry.name.startsWith("/") ||
        entry.name.includes("\\") ||
        entry.name.split("/").some((part) => !part || part === "." || part === "..")
      )
        throw new Error("Nama file ZIP tidak aman.");
      const before = await lstat(entry.path);
      if (!before.isFile() || before.isSymbolicLink())
        throw new Error("File snapshot ZIP tidak aman.");
      const initial = await hashFile(entry.path);
      // Ukuran reader diketahui: ZIP64 otomatis hanya bila perlu; DEFLATE kompatibel
      // dengan file kosong dan alat eksternal. Blob membaca file secara bertahap.
      await writer.add(
        entry.name,
        new BlobReader(await openAsBlob(entry.path)),
        encrypted ? { password, encryptionStrength: 3, level: 1 } : { level: 1 },
      );
      const after = await hashFile(entry.path);
      if (
        initial.size !== after.size ||
        initial.sha256 !== after.sha256 ||
        (entry.sha256 && entry.sha256 !== after.sha256)
      )
        throw new Error("Isi file berubah saat ZIP dibuat.");
      await onProgress?.(index + 1, entries.length);
    }
    await writer.close();
    return hashFile(destination);
  } catch (error) {
    await writer.close().catch(() => {});
    output.destroy();
    await rm(destination, { force: true }).catch(() => {});
    throw error;
  }
}

export function createEncryptedZip(destination, password, entries, onProgress) {
  if (!password) throw new Error("Kata sandi ZIP wajib diisi.");
  return createZip(destination, password, entries, onProgress);
}

export function createPlainZip(destination, entries, onProgress) {
  return createZip(destination, null, entries, onProgress);
}

export function pairedManifest(jobId, packageSha256, manifest) {
  const database = manifest.files.find((file) => file.path === manifest.databasePath);
  const uploads = manifest.files.filter((file) => file.path.startsWith("uploads/"));
  return {
    format: 2,
    timeZone: manifest.timeZone || "UTC",
    databasePath: manifest.databasePath,
    uploadsLayout: "direct",
    jobId,
    packageSha256,
    createdAt: manifest.createdAt,
    databaseSha256: database.sha256,
    uploadsSha256: createHash("sha256").update(JSON.stringify(uploads)).digest("hex"),
    uploadCount: uploads.length,
    issueCount: manifest.issueCount || 0,
  };
}
