import { createDecipheriv, createHash, scryptSync } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, open, stat } from "node:fs/promises";
import path from "node:path";
import { createGunzip } from "node:zlib";

const MAGIC = Buffer.from("SITOU-BACKUP-1\n");
const HEADER_BYTES = MAGIC.length + 16 + 12;

async function writeAll(handle, chunk) {
  let offset = 0;
  while (offset < chunk.length) {
    const { bytesWritten } = await handle.write(chunk, offset, chunk.length - offset);
    if (!bytesWritten) throw new Error("File ekstraksi tidak dapat ditulis.");
    offset += bytesWritten;
  }
}

/** Memverifikasi GCM, manifest, setiap ukuran/hash, serta path relatif sebelum ekstraksi opsional. */
export async function verifyArchive(archivePath, password, { extractRoot } = {}) {
  const size = (await stat(archivePath)).size;
  if (size < HEADER_BYTES + 16) throw new Error("Paket backup tidak lengkap.");
  const handle = await open(archivePath, "r");
  const header = Buffer.alloc(HEADER_BYTES);
  const tag = Buffer.alloc(16);
  try {
    await handle.read(header, 0, HEADER_BYTES, 0);
    await handle.read(tag, 0, 16, size - 16);
  } finally {
    await handle.close();
  }
  if (!header.subarray(0, MAGIC.length).equals(MAGIC))
    throw new Error("Format paket backup tidak dikenal.");
  const salt = header.subarray(MAGIC.length, MAGIC.length + 16);
  const iv = header.subarray(MAGIC.length + 16);
  const key = scryptSync(password, salt, 32, { N: 32768, maxmem: 64 * 1024 * 1024 });
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const source = createReadStream(archivePath, { start: HEADER_BYTES, end: size - 17 });
  const gunzip = createGunzip();
  source.once("error", (error) => decipher.destroy(error));
  decipher.once("error", (error) => gunzip.destroy(error));
  const plaintext = source.pipe(decipher).pipe(gunzip);

  let manifest = null;
  let headerBuffer = Buffer.alloc(0);
  let index = 0;
  let remaining = 0;
  let digest = null;
  let output = null;
  try {
    for await (let chunk of plaintext) {
      if (!manifest) {
        headerBuffer = Buffer.concat([headerBuffer, chunk]);
        if (headerBuffer.length > 64 * 1024 * 1024)
          throw new Error("Daftar isi backup terlalu besar.");
        const newline = headerBuffer.indexOf(10);
        if (newline < 0) continue;
        manifest = JSON.parse(headerBuffer.subarray(0, newline).toString("utf8"));
        if (
          manifest.format !== 3 ||
          !Array.isArray(manifest.files) ||
          !/^sitou_db_backup_\d{8}_\d{6}_(?:UTC|WIB|WITA|WIT|UTC[pm]\d{4})\.dump$/.test(
            manifest.databasePath || "",
          ) ||
          manifest.files[0]?.path !== manifest.databasePath ||
          (manifest.format === 3 &&
            (manifest.files[1]?.path !== "backup-file-issues.json" ||
              !Number.isSafeInteger(manifest.issueCount) ||
              manifest.issueCount < 0)) ||
          manifest.fileCount !== manifest.files.length - 2
        )
          throw new Error("Daftar isi backup tidak valid.");
        const paths = new Set();
        for (const [position, file] of manifest.files.entries()) {
          const validPath =
            position === 0
              ? file.path === manifest.databasePath
              : position === 1
                ? file.path === "backup-file-issues.json"
                : /^uploads\/[^\\]+$/.test(file.path || "");
          if (
            !validPath ||
            paths.has(file.path) ||
            !Number.isSafeInteger(file.size) ||
            file.size < 0 ||
            !/^[a-f0-9]{64}$/.test(file.sha256 || "") ||
            file.path.split("/").some((part) => !part || part === "." || part === "..")
          )
            throw new Error("Entri file backup tidak valid.");
          paths.add(file.path);
        }
        chunk = headerBuffer.subarray(newline + 1);
        headerBuffer = null;
      }
      while (chunk.length) {
        const file = manifest.files[index];
        if (!file) throw new Error("Isi paket lebih panjang daripada daftar file.");
        if (!digest) {
          if (
            !Number.isSafeInteger(file.size) ||
            file.size < 0 ||
            !/^[a-f0-9]{64}$/.test(file.sha256) ||
            !(
              file.path === manifest.databasePath ||
              /^(backup-file-issues\.json|uploads\/(?!.*(?:^|\/)\.\.\/)[^\\]+)$/.test(file.path)
            ) ||
            file.path.split("/").some((part) => !part || part === "." || part === "..")
          )
            throw new Error("Entri file backup tidak valid.");
          remaining = file.size;
          digest = createHash("sha256");
          if (extractRoot) {
            const outputPath = path.resolve(extractRoot, ...file.path.split("/"));
            if (!outputPath.startsWith(path.resolve(extractRoot) + path.sep))
              throw new Error("Path ekstraksi tidak aman.");
            await mkdir(path.dirname(outputPath), { recursive: true, mode: 0o700 });
            output = await open(outputPath, "wx", 0o600);
          }
        }
        const count = Math.min(remaining, chunk.length);
        const data = chunk.subarray(0, count);
        digest.update(data);
        if (output) await writeAll(output, data);
        remaining -= count;
        chunk = chunk.subarray(count);
        if (remaining === 0) {
          if (output) await output.close();
          output = null;
          if (digest.digest("hex") !== file.sha256)
            throw new Error("Hash file dalam backup tidak sesuai.");
          digest = null;
          index++;
        }
      }
    }
    while (manifest && index < manifest.files.length && manifest.files[index].size === 0) {
      const file = manifest.files[index];
      if (file.sha256 !== createHash("sha256").digest("hex"))
        throw new Error("Hash file dalam backup tidak sesuai.");
      if (extractRoot) {
        const outputPath = path.resolve(extractRoot, ...file.path.split("/"));
        if (
          !outputPath.startsWith(path.resolve(extractRoot) + path.sep) ||
          file.path.split("/").some((part) => !part || part === "." || part === "..")
        )
          throw new Error("Path ekstraksi tidak aman.");
        await mkdir(path.dirname(outputPath), { recursive: true, mode: 0o700 });
        const emptyFile = await open(outputPath, "wx", 0o600);
        await emptyFile.close();
      }
      index++;
    }
    if (!manifest || index !== manifest.files.length)
      throw new Error("Paket backup tidak lengkap.");
    return manifest;
  } finally {
    if (output) await output.close().catch(() => {});
    key.fill(0);
  }
}
