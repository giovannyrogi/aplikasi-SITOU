import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import dotenv from "dotenv";
import pg from "pg";
import { packagePath } from "../lib/system-backup/paths.mjs";

dotenv.config({ path: ".env.development", quiet: true });
if (!process.env.PGDATABASE || /prod/i.test(process.env.PGDATABASE))
  throw new Error("Tes restore hanya boleh memakai konfigurasi development.");
const name = `sitou_restore_test_${randomUUID().replaceAll("-", "").slice(0, 10)}`;
const root = await mkdtemp(path.join(os.tmpdir(), "sitou-restore-test-"));
const uploadRoot = path.join(root, "uploads");
const backupRoot = path.join(root, "backups");
const snapshotRoot = path.join(root, "snapshots");
const targetEnv = path.join(root, "restore.env");
const connection = {
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT || 5432),
};
const admin = new pg.Client({
  ...connection,
  database: process.env.PGADMIN_DATABASE || "postgres",
});
const passphrase = "restore-test-passphrase";
let database;
let oldDatabase;

function child(script, args, extraEnv, inputPassword = passphrase) {
  return new Promise((resolve, reject) => {
    const command = spawn(process.execPath, [script, ...args], {
      cwd: process.cwd(),
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
      env: {
        ...process.env,
        PGDATABASE: name,
        UPLOAD_ROOT: uploadRoot,
        BACKUP_ROOT: backupRoot,
        BACKUP_SNAPSHOT_ROOT: snapshotRoot,
        PG_DUMP_PATH:
          process.env.PG_DUMP_PATH ||
          (process.platform === "win32"
            ? "C:\\Program Files\\PostgreSQL\\18\\bin\\pg_dump.exe"
            : "pg_dump"),
        PG_RESTORE_PATH:
          process.env.PG_RESTORE_PATH ||
          (process.platform === "win32"
            ? "C:\\Program Files\\PostgreSQL\\18\\bin\\pg_restore.exe"
            : "pg_restore"),
        ...extraEnv,
      },
    });
    let output = "";
    let error = "";
    command.stdout.on("data", (chunk) => {
      output += chunk.toString("utf8");
    });
    command.stderr.on("data", (chunk) => {
      error += chunk.toString("utf8");
    });
    command.stdin.end(inputPassword + "\n");
    command.once("error", reject);
    command.once("close", (code) => resolve({ code, output, error }));
  });
}

try {
  await writeFile(
    targetEnv,
    [
      `PGUSER=${process.env.PGUSER}`,
      `PGPASSWORD=${process.env.PGPASSWORD}`,
      `PGHOST=${process.env.PGHOST || "localhost"}`,
      `PGPORT=${process.env.PGPORT || "5432"}`,
      `PGDATABASE=${name}`,
      `PGADMIN_DATABASE=${process.env.PGADMIN_DATABASE || "postgres"}`,
      `UPLOAD_ROOT=${uploadRoot}`,
      `BACKUP_ROOT=${backupRoot}`,
      `BACKUP_SNAPSHOT_ROOT=${snapshotRoot}`,
      `PG_RESTORE_PATH=${
        process.env.PG_RESTORE_PATH ||
        (process.platform === "win32"
          ? "C:\\Program Files\\PostgreSQL\\18\\bin\\pg_restore.exe"
          : "pg_restore")
      }`,
    ].join("\n") + "\n",
    { mode: 0o600 },
  );
  await admin.connect();
  await admin.query(`CREATE DATABASE ${pg.escapeIdentifier(name)}`);
  database = new pg.Client({ ...connection, database: name });
  await database.connect();
  await database.query(await readFile(new URL("../sitou_schema_v3.sql", import.meta.url), "utf8"));
  const actor = (
    await database.query(`INSERT INTO users(username,password_hash)
    VALUES('restore-test','test-only') RETURNING id`)
  ).rows[0].id;
  const organizationIds = [];
  for (const index of [1, 2]) {
    const orgId = (
      await database.query(
        `INSERT INTO organizations(code,name)
      VALUES($1,$2) RETURNING id`,
        [`R${index}`, `Organisasi Uji ${index}`],
      )
    ).rows[0].id;
    organizationIds.push(orgId);
    const key = `org_${orgId}/branding/${randomUUID()}.png`;
    const content = Buffer.from(`photo-${index}`);
    const target = path.join(uploadRoot, ...key.split("/"));
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content);
    const fileId = (
      await database.query(
        `INSERT INTO stored_files
      (organization_id,object_key,original_name,mime_type,size_bytes,sha256,category,malware_scan_status)
      VALUES($1,$2,$3,'image/png',$4,$5,'logo','clean') RETURNING id`,
        [
          orgId,
          key,
          `logo-${index}.png`,
          content.length,
          createHash("sha256").update(content).digest("hex"),
        ],
      )
    ).rows[0].id;
    await database.query(
      `INSERT INTO organization_branding(organization_id,logo_file_id)
      VALUES($1,$2)`,
      [orgId, fileId],
    );
  }
  const jobId = randomUUID();
  await database.query(
    `INSERT INTO system_backup_jobs(id,requested_by_user_id,request_id,time_zone)
    VALUES($1,$2,$3,'Asia/Makassar')`,
    [jobId, actor, randomUUID()],
  );
  const worker = await child("scripts/run-system-backup.mjs", [jobId]);
  assert.equal(worker.code, 0, worker.error);
  const archive = packagePath(
    backupRoot,
    jobId,
    (await database.query("SELECT created_at FROM system_backup_jobs WHERE id=$1", [jobId])).rows[0]
      .created_at,
    "Asia/Makassar",
  );
  await database.query(`INSERT INTO organizations(code,name) VALUES('AFTER','Sesudah Backup')`);
  await writeFile(path.join(uploadRoot, "after-backup.txt"), "new");
  const rejected = await child("scripts/restore-system-backup.mjs", [
    `--package=${archive}`,
    `--env=${targetEnv}`,
    "--apply",
    `--confirm=${name}`,
  ]);
  assert.notEqual(
    rejected.code,
    0,
    "Restore wajib menolak sesi database aplikasi yang masih aktif.",
  );
  assert.match(rejected.error, /masih terhubung/);
  assert.equal(
    (await database.query("SELECT count(*)::int AS count FROM organizations")).rows[0].count,
    3,
  );
  await database.end();
  database = null;
  const wrongPassword = await child(
    "scripts/restore-system-backup.mjs",
    [`--package=${archive}`, `--env=${targetEnv}`, "--apply", `--confirm=${name}`],
    {},
    "salah",
  );
  assert.notEqual(wrongPassword.code, 0, "Kata sandi salah harus ditolak.");
  const interrupted = await child(
    "scripts/restore-system-backup.mjs",
    [`--package=${archive}`, `--env=${targetEnv}`, "--apply", `--confirm=${name}`],
    { NODE_ENV: "test", SITOU_RESTORE_TEST_FAILURE: "after-db" },
  );
  assert.notEqual(
    interrupted.code,
    0,
    "Kegagalan di antara cutover database dan file harus rollback.",
  );
  const unchanged = new pg.Client({ ...connection, database: name });
  try {
    await unchanged.connect();
    assert.equal(
      (await unchanged.query("SELECT count(*)::int AS count FROM organizations")).rows[0].count,
      3,
    );
    assert.equal((await readFile(path.join(uploadRoot, "after-backup.txt"))).toString(), "new");
  } finally {
    await unchanged.end();
  }
  const restored = await child("scripts/restore-system-backup.mjs", [
    `--package=${archive}`,
    `--env=${targetEnv}`,
    "--apply",
    `--confirm=${name}`,
  ]);
  assert.equal(restored.code, 0, restored.error);
  oldDatabase = /Database sebelumnya: (sitou_before_[a-z0-9]+)/.exec(restored.output)?.[1];
  assert(oldDatabase, restored.output);
  database = new pg.Client({ ...connection, database: name });
  await database.connect();
  assert.equal(
    (await database.query("SELECT count(*)::int AS count FROM organizations")).rows[0].count,
    2,
  );
  await assert.rejects(() => readFile(path.join(uploadRoot, "after-backup.txt")), {
    code: "ENOENT",
  });
  assert.equal(
    (await database.query("SELECT count(*)::int AS count FROM stored_files")).rows[0].count,
    2,
  );
  console.log("Restore bersih dua organisasi, database, dan folder upload berhasil.");
} finally {
  if (database) await database.end().catch(() => {});
  if (oldDatabase)
    await admin
      .query(`DROP DATABASE IF EXISTS ${pg.escapeIdentifier(oldDatabase)} WITH (FORCE)`)
      .catch(() => {});
  await admin
    .query(`DROP DATABASE IF EXISTS ${pg.escapeIdentifier(name)} WITH (FORCE)`)
    .catch(() => {});
  await admin.end().catch(() => {});
  if (root.startsWith(path.resolve(os.tmpdir()) + path.sep))
    await rm(root, { recursive: true, force: true });
}
