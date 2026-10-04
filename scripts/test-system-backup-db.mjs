import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import dotenv from "dotenv";
import pg from "pg";
import { verifyArchive } from "../lib/system-backup/archive.mjs";
import { packagePath } from "../lib/system-backup/paths.mjs";

dotenv.config({ path: ".env.development", quiet: true });
if (!process.env.PGDATABASE || /prod/i.test(process.env.PGDATABASE))
  throw new Error("Test backup hanya boleh memakai konfigurasi database development.");

const name = `sitou_backup_test_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
const root = await mkdtemp(path.join(os.tmpdir(), "sitou-backup-db-"));
const uploadRoot = path.join(root, "uploads");
const backupRoot = path.join(root, "backups");
const snapshotRoot = path.join(root, "snapshots");
const connection = { user: process.env.PGUSER, password: process.env.PGPASSWORD,
  host: process.env.PGHOST, port: Number(process.env.PGPORT || 5432) };
const admin = new pg.Client({ ...connection, database: process.env.PGADMIN_DATABASE || "postgres" });
let database;
let created = false;
try {
  await admin.connect();
  await admin.query(`CREATE DATABASE "${name}"`);
  created = true;
  database = new pg.Client({ ...connection, database: name });
  await database.connect();
  await database.query(await readFile(new URL("../sitou_schema_v3.sql", import.meta.url), "utf8"));
  const upgraded = new pg.Client({ ...connection, database: process.env.PGDATABASE });
  await upgraded.connect();
  try {
    for (const sql of [
      `SELECT column_name,data_type,is_nullable,column_default FROM information_schema.columns
       WHERE table_schema='public' AND table_name='system_backup_jobs' ORDER BY column_name`,
      `SELECT conname,pg_get_constraintdef(oid) AS definition FROM pg_constraint
       WHERE conrelid='public.system_backup_jobs'::regclass ORDER BY conname`,
      `SELECT indexname,indexdef FROM pg_indexes
       WHERE schemaname='public' AND tablename='system_backup_jobs' ORDER BY indexname`,
    ]) {
      const [fresh, existing] = await Promise.all([database.query(sql), upgraded.query(sql)]);
      assert.deepEqual(fresh.rows, existing.rows, "Schema bootstrap backup harus sama dengan migration lokal.");
    }
  } finally { await upgraded.end(); }
  const actor = (await database.query(
    `INSERT INTO users(username,password_hash) VALUES('backup-test','test-only') RETURNING id`)).rows[0].id;
  const organizationIds = [];
  const storedPaths = [];
  for (const [index, content] of ["logo-one", "logo-two"].entries()) {
    const org = (await database.query(
      `INSERT INTO organizations(code,name) VALUES($1,$2) RETURNING id`, [`B${index + 1}`, `Organisasi ${index + 1}`])).rows[0].id;
    organizationIds.push(org);
    const key = `org_${org}/branding/${randomUUID()}.png`;
    const filePath = path.join(uploadRoot, ...key.split("/"));
    storedPaths.push(filePath);
    await mkdir(path.dirname(filePath), { recursive: true });
    const bytes = Buffer.from(content);
    await writeFile(filePath, bytes);
    const file = (await database.query(
      `INSERT INTO stored_files(organization_id,object_key,original_name,mime_type,size_bytes,sha256,category,malware_scan_status)
       VALUES($1,$2,$3,'image/png',$4,$5,'logo','clean') RETURNING id`,
      [org,key,`logo-${index + 1}.png`,bytes.length,createHash("sha256").update(bytes).digest("hex")])).rows[0].id;
    await database.query(`INSERT INTO organization_branding(organization_id,logo_file_id) VALUES($1,$2)`, [org,file]);
    if (index === 1) {
      const quarantineKey = `.trash/storage-maintenance/quarantine/org_${org}/${randomUUID()}.png`;
      const quarantinePath = path.join(uploadRoot, ...quarantineKey.split("/"));
      await mkdir(path.dirname(quarantinePath), { recursive: true });
      await rename(filePath, quarantinePath);
      await database.query(
        `UPDATE stored_files SET lifecycle_status='quarantined',quarantined_at=now(),
          malware_scan_status='infected' WHERE id=$1`, [file]);
      await database.query(
        `INSERT INTO file_quarantine_items(organization_id,stored_file_id,reason,
           original_object_key,quarantine_object_key,original_name,mime_type,size_bytes,
           sha256,malware_scan_status,purge_after)
         VALUES($1,$2,'malware',$3,$4,'logo-2.png','image/png',$5,$6,'infected',now()+interval '7 days')`,
        [org,file,key,quarantineKey,bytes.length,createHash("sha256").update(bytes).digest("hex")]);
      storedPaths[index] = quarantinePath;
    }
  }
  const jobId = randomUUID();
  await database.query(
    `INSERT INTO system_backup_jobs(id,requested_by_user_id,request_id) VALUES($1,$2,$3)`,
    [jobId,actor,randomUUID()]);
  const password = randomBytes(24).toString("hex");
  const pgDumpPath = process.env.PG_DUMP_PATH ||
    (process.platform === "win32" ? "C:\\Program Files\\PostgreSQL\\18\\bin\\pg_dump.exe" : "pg_dump");
  const workerLog = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["scripts/run-system-backup.mjs", jobId], {
      cwd: process.cwd(), stdio: ["pipe", "ignore", "pipe"], windowsHide: true,
      env: { ...process.env, PGDATABASE: name, UPLOAD_ROOT: uploadRoot, BACKUP_ROOT: backupRoot,
        BACKUP_SNAPSHOT_ROOT: snapshotRoot, PG_DUMP_PATH: pgDumpPath },
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk.toString("utf8").slice(0, 1000); });
    child.stdin.end(password + "\n");
    child.once("error", reject);
    child.once("close", (code) => code === 0 ? resolve(stderr) : reject(new Error(stderr || `Worker exit ${code}`)));
  });
  const status = (await database.query(`SELECT status,error_code,error_message,file_count,organization_count FROM system_backup_jobs WHERE id=$1`, [jobId])).rows[0];
  assert.equal(status.status, "ready", `${status.error_message || status.error_code || "Belum diproses"}. ${workerLog}`);
  assert.equal(status.organization_count, 2);
  assert.equal(Number(status.file_count), 2);
  const manifest = await verifyArchive(packagePath(backupRoot, jobId), password);
  assert.equal(manifest.fileCount, 2);
  assert(manifest.files.some((file) => file.path.startsWith(`uploads/org_${organizationIds[0]}/branding/`)));
  assert(manifest.files.some((file) => file.path.startsWith(`uploads/.trash/storage-maintenance/quarantine/org_${organizationIds[1]}/`)));
  const permissionRoles = (await database.query(
    `SELECT role.code FROM permissions permission JOIN role_permissions mapping ON mapping.permission_id=permission.id
     JOIN roles role ON role.id=mapping.role_id WHERE permission.code='system_backup.manage' ORDER BY role.code`)).rows.map((row) => row.code);
  assert.deepEqual(permissionRoles, ["superadmin"]);
  await database.query(`UPDATE system_backup_jobs SET expires_at=now()-interval '1 second' WHERE id=$1`, [jobId]);
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["scripts/expire-system-backups.mjs", "--once"], {
      cwd: process.cwd(), stdio: "ignore", windowsHide: true,
      env: { ...process.env, PGDATABASE: name, UPLOAD_ROOT: uploadRoot, BACKUP_ROOT: backupRoot,
        BACKUP_SNAPSHOT_ROOT: snapshotRoot },
    });
    child.once("error", reject);
    child.once("close", (code) => code === 0 ? resolve() : reject(new Error(`Worker kedaluwarsa exit ${code}`)));
  });
  assert.equal((await database.query(`SELECT status FROM system_backup_jobs WHERE id=$1`, [jobId])).rows[0].status, "expired");
  await assert.rejects(() => readFile(packagePath(backupRoot, jobId)), { code: "ENOENT" });
  await rm(storedPaths[0]);
  const missingJobId = randomUUID();
  await database.query(`INSERT INTO system_backup_jobs(id,requested_by_user_id,request_id) VALUES($1,$2,$3)`,
    [missingJobId,actor,randomUUID()]);
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["scripts/run-system-backup.mjs", missingJobId], {
      cwd: process.cwd(), stdio: ["pipe", "ignore", "ignore"], windowsHide: true,
      env: { ...process.env, PGDATABASE: name, UPLOAD_ROOT: uploadRoot, BACKUP_ROOT: backupRoot,
        BACKUP_SNAPSHOT_ROOT: snapshotRoot, PG_DUMP_PATH: pgDumpPath },
    });
    child.stdin.end(password + "\n");
    child.once("error", reject);
    child.once("close", (code) => code === 0 ? resolve() : reject(new Error(`Worker exit ${code}`)));
  });
  const missingStatus = (await database.query(`SELECT status,error_message FROM system_backup_jobs WHERE id=$1`, [missingJobId])).rows[0];
  assert.equal(missingStatus.status, "failed");
  assert.match(missingStatus.error_message, /Penyimpanan File/);
  const staleJobId = randomUUID();
  await database.query(
    `INSERT INTO system_backup_jobs(id,requested_by_user_id,request_id,created_at,heartbeat_at)
     VALUES($1,$2,$3,now()-interval '1 hour',now()-interval '11 minutes')`,
    [staleJobId,actor,randomUUID()]);
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["scripts/expire-system-backups.mjs", "--once"], {
      cwd: process.cwd(), stdio: "ignore", windowsHide: true,
      env: { ...process.env, PGDATABASE: name, UPLOAD_ROOT: uploadRoot, BACKUP_ROOT: backupRoot,
        BACKUP_SNAPSHOT_ROOT: snapshotRoot },
    });
    child.once("error", reject);
    child.once("close", (code) => code === 0 ? resolve() : reject(new Error(`Worker kedaluwarsa exit ${code}`)));
  });
  assert.equal((await database.query(`SELECT status FROM system_backup_jobs WHERE id=$1`, [staleJobId])).rows[0].status, "failed");
  console.log("Backup database dan dua organisasi berhasil dibuat serta diverifikasi.");
} finally {
  if (database) await database.end().catch(() => {});
  if (created) await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`).catch(() => {});
  await admin.end().catch(() => {});
  if (root.startsWith(path.resolve(os.tmpdir()) + path.sep))
    await rm(root, { recursive: true, force: true });
}
