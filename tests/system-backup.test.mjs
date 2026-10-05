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
import { describeBackupFailure } from "../lib/system-backup/diagnostics.mjs";
import { createEncryptedZip, pairedManifest } from "../lib/system-backup/artifacts.mjs";
import { safeBackupCategory, stagePercent } from "../lib/system-backup/progress.mjs";
import { Uint8ArrayReader, TextWriter, ZipReader } from "@zip.js/zip.js";

test("progres hanya memberi persen saat total pasti dan kategori tidak membocorkan path", () => {
  assert.equal(stagePercent(200, null), null);
  assert.equal(stagePercent(0, 0), null);
  assert.equal(stagePercent(99, 100), 99);
  assert.equal(stagePercent(100, 100), 99);
  assert.equal(stagePercent(100, 100, true), 100);
  assert.equal(safeBackupCategory("uploads/org_1/pegawai/employee_7/identitas/ktp/secret.jpg"),
    "Dokumen identitas");
  assert.equal(safeBackupCategory("uploads/org_1/private-name.jpg"), "File lainnya");
});

test("ZIP tambahan memakai AES-256, pasangan backup, dan kata sandi", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "sitou-zip-test-"));
  try {
    const file = path.join(temp, "photo.jpg");
    await writeFile(file, "sample-photo");
    const zipPath = path.join(temp, "uploads.zip");
    const result = await createEncryptedZip(zipPath, "rahasia", [{ name: "uploads/org_1/photo.jpg", path: file }]);
    assert.equal(result.size > 0, true);
    const reader = new ZipReader(new Uint8ArrayReader(await readFile(zipPath)));
    try {
      const entries = await reader.getEntries();
      assert.equal(entries[0].encrypted, true);
      assert.equal(entries[0].zipCrypto, false);
      await assert.rejects(() => entries[0].getData(new TextWriter(), { password: "salah" }));
      assert.equal(await entries[0].getData(new TextWriter(), { password: "rahasia" }), "sample-photo");
    } finally { await reader.close(); }
    const pair = pairedManifest("job", "a".repeat(64), { createdAt: "2026-10-04T00:00:00Z", issueCount: 1,
      files: [{ path: "database.dump", sha256: "b".repeat(64) },
        { path: "uploads/org_1/photo.jpg", sha256: "c".repeat(64), size: 12 }] });
    assert.equal(pair.databaseSha256, "b".repeat(64));
    assert.equal(pair.uploadCount, 1);
    await assert.rejects(() => createEncryptedZip(path.join(temp, "bad.zip"), "rahasia",
      [{ name: "../secret", path: file }]), /tidak aman/);
  } finally { await rm(temp, { recursive: true, force: true }); }
});

test("diagnostik pg_dump membedakan path, izin, snapshot, dan menyamarkan lokasi", () => {
  assert.equal(describeBackupFailure({ code: "ENOENT", source: "pg_dump" }).code, "PG_DUMP_NOT_FOUND");
  assert.equal(describeBackupFailure({ code: "ENOENT", source: "backup_output" }).code,
    "BACKUP_OUTPUT_UNAVAILABLE");
  assert.equal(describeBackupFailure({ commandStderr: "pg_dump: error: permission denied for table employees" }).code,
    "PG_DUMP_PERMISSION_DENIED");
  assert.equal(describeBackupFailure({ commandStderr: "pg_dump: error: invalid snapshot identifier" }).code,
    "PG_DUMP_SNAPSHOT_FAILED");
  const result = describeBackupFailure({ commandStderr:
    'pg_dump: error: could not open file "/srv/private/uploads/org_7/secret.pdf"' });
  assert.equal(result.code, "PG_DUMP_FAILED");
  assert.doesNotMatch(result.message, /\/srv|secret\.pdf|org_7/);
  const sql = describeBackupFailure({ commandStderr:
    "pg_dump: error: unexpected failure\npg_dump: detail: Command was: SELECT secret FROM employee_private" });
  assert.doesNotMatch(sql.message, /SELECT|employee_private|secret/);
  assert.match(describeBackupFailure({ commandStderr: "pg_dump: error: failed" }, "dump").message,
    /Saat mencadangkan database/);
});

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
