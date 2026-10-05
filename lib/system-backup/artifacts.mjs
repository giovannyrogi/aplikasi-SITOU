import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { lstat, rm } from "node:fs/promises";
import { Readable, Writable } from "node:stream";
import { ZipWriter } from "@zip.js/zip.js";

export async function hashFile(filePath) {
  const hash = createHash("sha256");
  let size = 0;
  for await (const chunk of createReadStream(filePath)) {
    hash.update(chunk);
    size += chunk.length;
  }
  return { sha256: hash.digest("hex"), size };
}

/** ZIP ditulis streaming; password opsional hanya untuk ZIP bagian dalam yang tetap berada di server. */
async function createZip(destination, password, entries) {
  const output = createWriteStream(destination, { flags: "wx", mode: 0o600 });
  const encrypted = Boolean(password);
  const writer = new ZipWriter(Writable.toWeb(output), encrypted
    ? { password, encryptionStrength: 3, zip64: true, level: 0 }
    : { zip64: true, level: 0 });
  try {
    for (const entry of entries) {
      if (!entry.name || entry.name.startsWith("/") || entry.name.includes("\\") ||
          entry.name.split("/").some((part) => !part || part === "." || part === ".."))
        throw new Error("Nama file ZIP tidak aman.");
      const before = await lstat(entry.path);
      if (!before.isFile() || before.isSymbolicLink()) throw new Error("File snapshot ZIP tidak aman.");
      const initial = await hashFile(entry.path);
      await writer.add(entry.name, Readable.toWeb(createReadStream(entry.path)), encrypted
        ? { password, encryptionStrength: 3, zip64: true, level: 0 }
        : { zip64: true, level: 0 });
      const after = await hashFile(entry.path);
      if (initial.size !== after.size || initial.sha256 !== after.sha256 ||
          (entry.sha256 && entry.sha256 !== after.sha256))
        throw new Error("Isi file berubah saat ZIP dibuat.");
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

export function createEncryptedZip(destination, password, entries) {
  if (!password) throw new Error("Kata sandi ZIP wajib diisi.");
  return createZip(destination, password, entries);
}

export function createPlainZip(destination, entries) {
  return createZip(destination, null, entries);
}

export function pairedManifest(jobId, packageSha256, manifest) {
  const database = manifest.files.find((file) => file.path === "database.dump");
  const uploads = manifest.files.filter((file) => file.path.startsWith("uploads/"));
  return {
    format: 1, jobId, packageSha256, createdAt: manifest.createdAt,
    databaseSha256: database.sha256,
    uploadsSha256: createHash("sha256").update(JSON.stringify(uploads)).digest("hex"),
    uploadCount: uploads.length, issueCount: manifest.issueCount || 0,
  };
}
