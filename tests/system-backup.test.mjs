import assert from "node:assert/strict";
import { test } from "node:test";
import { createCipheriv, createHash, randomBytes, scryptSync } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { verifyArchive } from "../lib/system-backup/archive.mjs";
import { backupPaths, packagePath } from "../lib/system-backup/paths.mjs";
import { createBackupSchema } from "../lib/system-backup/validation.mjs";

test("kata sandi backup pendek diterima tetapi tidak boleh kosong atau berbeda dari konfirmasi", () => {
  assert.equal(createBackupSchema.safeParse({ password: "abc", confirmPassword: "abc" }).success, true);
  assert.equal(createBackupSchema.safeParse({ password: "", confirmPassword: "" }).success, false);
  assert.equal(createBackupSchema.safeParse({ password: "   ", confirmPassword: "   " }).success, false);
  assert.equal(createBackupSchema.safeParse({ password: "abc", confirmPassword: "xyz" }).success, false);
});

async function fixture(directory, entries, password = "example-password-long") {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const manifest = { format: 1, organizationCount: 2, fileCount: entries.length - 1,
    files: entries.map(([name, bytes]) => ({ path: name, size: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex") })) };
  const plaintext = Buffer.concat([Buffer.from(JSON.stringify(manifest) + "\n"), ...entries.map(([, bytes]) => bytes)]);
  const key = scryptSync(password, salt, 32, { N: 32768, maxmem: 64 * 1024 * 1024 });
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(gzipSync(plaintext)), cipher.final()]);
  const output = path.join(directory, "test.sitou-backup");
  await writeFile(output, Buffer.concat([Buffer.from("SITOU-BACKUP-1\n"), salt, iv, encrypted, cipher.getAuthTag()]));
  key.fill(0);
  return output;
}

test("paket terenkripsi diverifikasi dan dapat diekstrak tanpa path privat server", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "sitou-backup-test-"));
  try {
    const archive = await fixture(temp, [["database.dump", Buffer.from("PGDMP")],
      ["uploads/org_1/pegawai/photo.jpg", Buffer.from("photo")],
      ["uploads/org_2/empty.txt", Buffer.alloc(0)]]);
    const manifest = await verifyArchive(archive, "example-password-long", { extractRoot: path.join(temp, "out") });
    assert.equal(manifest.fileCount, 2);
    assert.equal((await readFile(path.join(temp, "out", "database.dump"))).toString(), "PGDMP");
    assert.equal((await readFile(path.join(temp, "out", "uploads", "org_1", "pegawai", "photo.jpg"))).toString(), "photo");
    await assert.rejects(() => verifyArchive(archive, "wrong-password"));
  } finally { await rm(temp, { recursive: true, force: true }); }
});

test("paket menolak path traversal meski autentikasi kriptografi valid", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "sitou-backup-test-"));
  try {
    const archive = await fixture(temp, [["database.dump", Buffer.from("PGDMP")],
      ["uploads/../secret", Buffer.from("x")]]);
    await assert.rejects(() => verifyArchive(archive, "example-password-long", { extractRoot: path.join(temp, "out") }), /tidak valid/);
  } finally { await rm(temp, { recursive: true, force: true }); }
});

test("perubahan satu byte pada paket terenkripsi ditolak", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "sitou-backup-test-"));
  try {
    const archive = await fixture(temp, [["database.dump", Buffer.from("PGDMP")]]);
    const bytes = await readFile(archive);
    bytes[bytes.length - 20] ^= 1;
    await writeFile(archive, bytes);
    await assert.rejects(() => verifyArchive(archive, "example-password-long"));
  } finally { await rm(temp, { recursive: true, force: true }); }
});

test("root backup dan snapshot dilarang berada di dalam upload", () => {
  const prior = { upload: process.env.UPLOAD_ROOT, backup: process.env.BACKUP_ROOT };
  const root = path.join(os.tmpdir(), "sitou-test-upload");
  try {
    process.env.UPLOAD_ROOT = root;
    process.env.BACKUP_ROOT = path.join(root, "backups");
    assert.throws(() => backupPaths(), /di luar UPLOAD_ROOT/);
    assert.throws(() => packagePath(os.tmpdir(), "../other"), /tidak valid/);
  } finally {
    if (prior.upload === undefined) delete process.env.UPLOAD_ROOT;
    else process.env.UPLOAD_ROOT = prior.upload;
    if (prior.backup === undefined) delete process.env.BACKUP_ROOT;
    else process.env.BACKUP_ROOT = prior.backup;
  }
});
