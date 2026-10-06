import assert from "node:assert/strict";
import { test } from "node:test";
import { createCipheriv, createHash, randomBytes, scryptSync } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile, readdir, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { verifyArchive } from "../lib/system-backup/archive.mjs";
import {
  backupPaths,
  packagePath,
  backupNames,
  backupJobDirectory,
  assertBackupJobDirectory,
  cleanupBackupJobFiles,
} from "../lib/system-backup/paths.mjs";
import { createBackupSchema } from "../lib/system-backup/validation.mjs";
import { describeBackupFailure } from "../lib/system-backup/diagnostics.mjs";
import { createEncryptedZip, pairedManifest } from "../lib/system-backup/artifacts.mjs";
import { safeBackupCategory, stagePercent } from "../lib/system-backup/progress.mjs";
import { Uint8ArrayReader, TextWriter, ZipReader } from "@zip.js/zip.js";
import {
  backupClock,
  configuredBackupTimeZone,
  formatBackupDate,
} from "../lib/system-backup/timezone.mjs";

test("tampilan pengguna mengonversi waktu absolut tanpa mengubah nama artefak", () => {
  const value = "2026-10-06T03:38:08Z";
  assert.match(formatBackupDate(value, "Asia/Jakarta"), /10\.38 WIB$/);
  assert.match(formatBackupDate(value, "Asia/Makassar"), /11\.38 WITA$/);
  assert.match(formatBackupDate(value, "Asia/Jayapura"), /12\.38 WIT$/);
  assert.match(formatBackupDate(value, "UTC"), /03\.38 UTC$/);
  assert.match(formatBackupDate(value, "Asia/Kolkata"), /UTC\+05:30$/);
  assert.match(formatBackupDate("2026-10-05T17:30:00Z", "Asia/Jakarta"), /^6 Okt 2026/);
  assert.equal(formatBackupDate(null, "Asia/Jakarta"), "Belum tersedia");
});

test("nama backup mengikuti WITA yang tersimpan, termasuk pergantian tanggal dan host UTC", () => {
  const id = "11111111-1111-1111-1111-111111111111";
  const time = "2026-10-05T19:38:08Z";
  assert.equal(
    backupNames(id, time, "Asia/Makassar").database,
    "sitou_db_backup_20261006_033808_WITA.dump",
  );
  assert.equal(
    backupNames(id, "2026-10-06T03:38:08Z", "Asia/Makassar").database,
    "sitou_db_backup_20261006_113808_WITA.dump",
  );
  assert.equal(backupNames(id, time, "UTC").database, "sitou_db_backup_20261005_193808_UTC.dump");
  assert.equal(backupClock(time, "Asia/Jakarta").label, "WIB");
  assert.equal(backupClock(time, "Asia/Jayapura").label, "WIT");
  const prior = process.env.BACKUP_TIME_ZONE;
  try {
    process.env.BACKUP_TIME_ZONE = "UTC";
    assert.equal(configuredBackupTimeZone(), "UTC");
    assert.equal(
      backupNames(id, time, "Asia/Makassar").database,
      "sitou_db_backup_20261006_033808_WITA.dump",
    );
    process.env.BACKUP_TIME_ZONE = "Invalid/Zone";
    assert.throws(configuredBackupTimeZone);
  } finally {
    if (prior === undefined) delete process.env.BACKUP_TIME_ZONE;
    else process.env.BACKUP_TIME_ZONE = prior;
  }
});
import { parsePgDumpMajorVersion } from "../lib/system-backup/postgres-version.mjs";

test("versi pg_dump Windows, Ubuntu, dan Debian dibaca dari versi PostgreSQL", () => {
  for (const output of [
    "pg_dump (PostgreSQL) 18.0\n",
    "pg_dump (PostgreSQL) 18.1 (Ubuntu 18.1-1.pgdg24.04+1)\n",
    "pg_dump (PostgreSQL) 18.0 (Debian 18.0-1.pgdg12+1)\n",
  ])
    assert.equal(parsePgDumpMajorVersion(output), 18);
  assert.equal(
    parsePgDumpMajorVersion("pg_dump (PostgreSQL) 16.10 (Ubuntu 16.10-0ubuntu0.24.04.1)"),
    16,
  );
  for (const output of [
    "",
    "error 18",
    "pg_dump 18",
    "pg_dump (PostgreSQL) unknown",
    "pg_dump (PostgreSQL) 18oops",
  ])
    assert.equal(parsePgDumpMajorVersion(output), null);
});

test("progres hanya memberi persen saat total pasti dan kategori tidak membocorkan path", () => {
  assert.equal(stagePercent(200, null), null);
  assert.equal(stagePercent(0, 0), null);
  assert.equal(stagePercent(99, 100), 99);
  assert.equal(stagePercent(100, 100), 99);
  assert.equal(stagePercent(100, 100, true), 100);
  assert.equal(
    safeBackupCategory("uploads/org_1/pegawai/employee_7/identitas/ktp/secret.jpg"),
    "Dokumen identitas",
  );
  assert.equal(safeBackupCategory("uploads/org_1/private-name.jpg"), "File lainnya");
});

test("ZIP tambahan memakai AES-256, pasangan backup, dan kata sandi", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "sitou-zip-test-"));
  try {
    const file = path.join(temp, "photo.jpg");
    await writeFile(file, "sample-photo");
    const zipPath = path.join(temp, "uploads.zip");
    const result = await createEncryptedZip(zipPath, "rahasia", [
      { name: "uploads/org_1/photo.jpg", path: file },
    ]);
    assert.equal(result.size > 0, true);
    const reader = new ZipReader(new Uint8ArrayReader(await readFile(zipPath)));
    try {
      const entries = await reader.getEntries();
      assert.equal(entries[0].encrypted, true);
      assert.equal(entries[0].zipCrypto, false);
      assert.equal(entries[0].compressionMethod, 8);
      assert.equal(entries[0].zip64, false);
      await assert.rejects(() => entries[0].getData(new TextWriter(), { password: "salah" }));
      assert.equal(
        await entries[0].getData(new TextWriter(), { password: "rahasia" }),
        "sample-photo",
      );
    } finally {
      await reader.close();
    }
    const pair = pairedManifest("job", "a".repeat(64), {
      createdAt: "2026-10-06T01:30:15Z",
      databasePath: "sitou_db_backup_20261006_013015_UTC.dump",
      issueCount: 1,
      files: [
        { path: "sitou_db_backup_20261006_013015_UTC.dump", sha256: "b".repeat(64) },
        { path: "uploads/org_1/photo.jpg", sha256: "c".repeat(64), size: 12 },
      ],
    });
    assert.equal(pair.databaseSha256, "b".repeat(64));
    assert.equal(pair.uploadCount, 1);
    await assert.rejects(
      () =>
        createEncryptedZip(path.join(temp, "bad.zip"), "rahasia", [
          { name: "../secret", path: file },
        ]),
      /tidak aman/,
    );
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test("ZIP berisi file besar dan kosong dibuka oleh WinRAR serta 7-Zip dengan kata sandi angka", async (t) => {
  if (process.platform !== "win32") return t.skip("Uji WinRAR dijalankan pada Windows.");
  const root = await mkdtemp(path.join(os.tmpdir(), "sitou-zip-external-"));
  try {
    const big = path.join(root, "fixture.dump"),
      empty = path.join(root, "empty.txt");
    await writeFile(big, randomBytes(3 * 1024 * 1024 + 11));
    await writeFile(empty, "");
    const zip = path.join(root, "fixture.zip");
    await createEncryptedZip(zip, "123456", [
      { name: "fixture.dump", path: big },
      { name: "uploads/empty.txt", path: empty },
    ]);
    for (const binary of ["C:/Program Files/7-Zip/7z.exe", "C:/Program Files/WinRAR/WinRAR.exe"]) {
      const result = spawnSync(
        binary,
        ["t", "-p123456", ...(binary.includes("WinRAR") ? ["-inul"] : []), zip],
        { windowsHide: true, timeout: 15000 },
      );
      if (result.error?.code === "ENOENT") continue;
      assert.equal(result.status, 0, `${path.basename(binary)} menolak fixture ZIP.`);
    }
    const valid = spawnSync(process.execPath, ["scripts/verify-system-backup-zip.mjs", zip], {
      input: "123456\n",
      encoding: "utf8",
      windowsHide: true,
    });
    assert.equal(valid.status, 0, valid.stderr);
    assert.match(valid.stdout, /ZIP valid/);
    const invalid = spawnSync(process.execPath, ["scripts/verify-system-backup-zip.mjs", zip], {
      input: "999999\n",
      encoding: "utf8",
      windowsHide: true,
    });
    assert.equal(invalid.status, 1);
    assert.match(invalid.stderr, /menolak kata sandi/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("diagnostik pg_dump membedakan path, izin, snapshot, dan menyamarkan lokasi", () => {
  assert.equal(
    describeBackupFailure({ code: "ENOENT", source: "pg_dump" }).code,
    "PG_DUMP_NOT_FOUND",
  );
  assert.equal(
    describeBackupFailure({ code: "ENOENT", source: "backup_output" }).code,
    "BACKUP_OUTPUT_UNAVAILABLE",
  );
  assert.equal(
    describeBackupFailure({
      commandStderr: "pg_dump: error: permission denied for table employees",
    }).code,
    "PG_DUMP_PERMISSION_DENIED",
  );
  assert.equal(
    describeBackupFailure({ commandStderr: "pg_dump: error: invalid snapshot identifier" }).code,
    "PG_DUMP_SNAPSHOT_FAILED",
  );
  const result = describeBackupFailure({
    commandStderr: 'pg_dump: error: could not open file "/srv/private/uploads/org_7/secret.pdf"',
  });
  assert.equal(result.code, "PG_DUMP_FAILED");
  assert.doesNotMatch(result.message, /\/srv|secret\.pdf|org_7/);
  const sql = describeBackupFailure({
    commandStderr:
      "pg_dump: error: unexpected failure\npg_dump: detail: Command was: SELECT secret FROM employee_private",
  });
  assert.doesNotMatch(sql.message, /SELECT|employee_private|secret/);
  assert.match(
    describeBackupFailure({ commandStderr: "pg_dump: error: failed" }, "dump").message,
    /Saat mencadangkan database/,
  );
});

test("kata sandi backup pendek diterima tetapi tidak boleh kosong atau berbeda dari konfirmasi", () => {
  assert.equal(createBackupSchema.safeParse({ password: "a", confirmPassword: "a" }).success, true);
  assert.equal(
    createBackupSchema.safeParse({ password: "abc", confirmPassword: "abc" }).success,
    true,
  );
  assert.equal(createBackupSchema.safeParse({ password: "", confirmPassword: "" }).success, false);
  assert.equal(
    createBackupSchema.safeParse({ password: "   ", confirmPassword: "   " }).success,
    false,
  );
  assert.equal(
    createBackupSchema.safeParse({ password: "abc", confirmPassword: "xyz" }).success,
    false,
  );
});

test("folder backup memakai tanggal UTC dan UUID; cleanup menjaga file asing dan pekerjaan lain", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "sitou-backup-paths-"));
  const id = "11111111-1111-1111-1111-111111111111";
  const second = "22222222-2222-2222-2222-222222222222";
  const createdAt = "2026-10-06T09:30:15+08:00";
  try {
    assert.equal(backupNames(id, createdAt).folder, `backup_2026-10-06_01-30-15_UTC_${id}`);
    assert.equal(backupNames(id, createdAt).database, "sitou_db_backup_20261006_013015_UTC.dump");
    assert.notEqual(
      backupJobDirectory(root, id, createdAt),
      backupJobDirectory(root, second, createdAt),
    );
    const directory = await assertBackupJobDirectory(root, id, createdAt, { create: true });
    const secondDirectory = await assertBackupJobDirectory(root, second, createdAt, {
      create: true,
    });
    for (const kind of ["package", "database_zip", "uploads_zip"])
      await writeFile(path.join(directory, backupNames(id, createdAt)[kind]), "encrypted-fixture");
    await writeFile(path.join(directory, "unknown.txt"), "preserve");
    await writeFile(path.join(secondDirectory, "untouched.txt"), "preserve");
    await cleanupBackupJobFiles(root, id, createdAt);
    assert.deepEqual(await readdir(directory), ["unknown.txt"]);
    assert.equal(await readFile(path.join(secondDirectory, "untouched.txt"), "utf8"), "preserve");
    await rm(path.join(directory, "unknown.txt"));
    await cleanupBackupJobFiles(root, id, createdAt);
    await cleanupBackupJobFiles(root, id, createdAt);
    await assert.rejects(readdir(directory), { code: "ENOENT" });
    await symlink(secondDirectory, directory, process.platform === "win32" ? "junction" : "dir");
    await assert.rejects(assertBackupJobDirectory(root, id, createdAt), /tidak aman/);
    await assert.rejects(cleanupBackupJobFiles(root, id, createdAt), /tidak aman/);
    assert.throws(() => backupNames(id, "bad-date"), /tidak valid/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

async function fixture(directory, entries, password = "example-password-long") {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  entries = [entries[0], ["backup-file-issues.json", Buffer.from("{}")], ...entries.slice(1)];
  const manifest = {
    format: 3,
    databasePath: "sitou_db_backup_20261006_013015_UTC.dump",
    issueCount: 0,
    organizationCount: 2,
    fileCount: entries.length - 2,
    files: entries.map(([name, bytes]) => ({
      path: name,
      size: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    })),
  };
  const plaintext = Buffer.concat([
    Buffer.from(JSON.stringify(manifest) + "\n"),
    ...entries.map(([, bytes]) => bytes),
  ]);
  const key = scryptSync(password, salt, 32, { N: 32768, maxmem: 64 * 1024 * 1024 });
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(gzipSync(plaintext)), cipher.final()]);
  const output = path.join(directory, "test.sitou-backup");
  await writeFile(
    output,
    Buffer.concat([Buffer.from("SITOU-BACKUP-1\n"), salt, iv, encrypted, cipher.getAuthTag()]),
  );
  key.fill(0);
  return output;
}

test("paket terenkripsi diverifikasi dan dapat diekstrak tanpa path privat server", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "sitou-backup-test-"));
  try {
    const archive = await fixture(temp, [
      ["sitou_db_backup_20261006_013015_UTC.dump", Buffer.from("PGDMP")],
      ["uploads/org_1/pegawai/photo.jpg", Buffer.from("photo")],
      ["uploads/org_2/empty.txt", Buffer.alloc(0)],
    ]);
    const manifest = await verifyArchive(archive, "example-password-long", {
      extractRoot: path.join(temp, "out"),
    });
    assert.equal(manifest.fileCount, 2);
    assert.equal(
      (
        await readFile(path.join(temp, "out", "sitou_db_backup_20261006_013015_UTC.dump"))
      ).toString(),
      "PGDMP",
    );
    assert.equal(
      (
        await readFile(path.join(temp, "out", "uploads", "org_1", "pegawai", "photo.jpg"))
      ).toString(),
      "photo",
    );
    await assert.rejects(() => verifyArchive(archive, "wrong-password"));
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test("paket menolak path traversal meski autentikasi kriptografi valid", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "sitou-backup-test-"));
  try {
    const archive = await fixture(temp, [
      ["sitou_db_backup_20261006_013015_UTC.dump", Buffer.from("PGDMP")],
      ["uploads/../secret", Buffer.from("x")],
    ]);
    await assert.rejects(
      () =>
        verifyArchive(archive, "example-password-long", { extractRoot: path.join(temp, "out") }),
      /tidak valid/,
    );
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test("perubahan satu byte pada paket terenkripsi ditolak", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "sitou-backup-test-"));
  try {
    const archive = await fixture(temp, [
      ["sitou_db_backup_20261006_013015_UTC.dump", Buffer.from("PGDMP")],
    ]);
    const bytes = await readFile(archive);
    bytes[bytes.length - 20] ^= 1;
    await writeFile(archive, bytes);
    await assert.rejects(() => verifyArchive(archive, "example-password-long"));
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
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
