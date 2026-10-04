import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { opendir, statfs, lstat } from "node:fs/promises";
import path from "node:path";
import pool from "@/lib/dbConfig";
import { writeAudit } from "@/lib/audit";
import { ServiceError } from "@/lib/api/routeHelpers";
import { backupPaths } from "./paths.mjs";

const JOB_FIELDS = `id::text,status,organization_count,file_count,file_bytes,package_bytes,
  package_sha256,created_at,started_at,completed_at,expires_at,error_code,error_message,
  requested_by_user_id::text,
  (SELECT display_name FROM v_user_identity WHERE user_id=requested_by_user_id LIMIT 1) AS requested_by_name`;

/** Menyaring path internal dan hanya mengembalikan metadata aman untuk browser. */
export async function listBackups() {
  const result = await pool.query(
    `SELECT ${JOB_FIELDS} FROM system_backup_jobs ORDER BY created_at DESC,id DESC LIMIT 50`,
  );
  return result.rows;
}

/** Detail pekerjaan dibaca tanpa membuka path internal paket. */
export async function getBackup(id) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
    throw new ServiceError("BACKUP_ID_INVALID", "ID backup tidak valid.", 400);
  const result = await pool.query(`SELECT ${JOB_FIELDS} FROM system_backup_jobs WHERE id=$1::uuid`, [id]);
  if (!result.rows[0]) throw new ServiceError("BACKUP_NOT_FOUND", "Backup tidak ditemukan.", 404);
  return result.rows[0];
}

async function sumFiles(directory) {
  let bytes = 0;
  let count = 0;
  let entries;
  try { entries = await opendir(directory); }
  catch (error) { if (error.code === "ENOENT") return { bytes, count }; throw error; }
  for await (const entry of entries) {
    const target = path.join(directory, entry.name);
    const metadata = await lstat(target);
    if (metadata.isSymbolicLink())
      throw new ServiceError("UPLOAD_SYMLINK", "Ada tautan file yang tidak aman di folder upload.", 503);
    if (metadata.isDirectory()) {
      const nested = await sumFiles(target);
      bytes += nested.bytes; count += nested.count;
    } else if (metadata.isFile()) { bytes += metadata.size; count++; }
  }
  return { bytes, count };
}

/** Perkiraan sebelum backup, bukan janji ukuran akhir karena kompresi bergantung isi. */
export async function estimateBackup() {
  const { uploadRoot, backupRoot } = backupPaths();
  const [files, database] = await Promise.all([
    sumFiles(uploadRoot), pool.query("SELECT pg_database_size(current_database())::bigint AS bytes"),
  ]);
  let freeBytes = null;
  try { const disk = await statfs(backupRoot); freeBytes = Number(disk.bavail) * Number(disk.bsize); }
  catch { /* Folder backup mungkin belum dibuat; worker akan memeriksa saat mulai. */ }
  return { organizationScope: "all", fileCount: files.count, fileBytes: files.bytes,
    databaseBytes: Number(database.rows[0].bytes), freeBytes };
}

/** Kata sandi hanya dikirim melalui stdin child process; tidak masuk database, argv, atau log. */
export async function createBackup({ user, password, requestId }) {
  backupPaths();
  const resolveRetry = async (record) => {
    if (record.requested_by_user_id !== String(user.id))
      throw new ServiceError("REQUEST_ID_USED", "ID permintaan sudah digunakan.", 409);
    const job = await getBackup(record.id);
    if (["failed", "expired"].includes(job.status))
      throw new ServiceError("BACKUP_PREVIOUS_FAILED", "Permintaan sebelumnya tidak dapat digunakan. Mulai backup baru.", 409);
    return job;
  };
  const previous = await pool.query(
    `SELECT id::text,requested_by_user_id::text FROM system_backup_jobs WHERE request_id=$1`,
    [requestId],
  );
  if (previous.rows[0]) return resolveRetry(previous.rows[0]);
  const id = randomUUID();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO system_backup_jobs(id,requested_by_user_id,request_id)
       VALUES($1,$2,$3)`,
      [id, user.id, requestId],
    );
    await writeAudit(client, {
      actorUserId: user.id,
      action: "system_backup.requested",
      entityType: "system_backup_job",
      entityId: id,
      requestId,
    });
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    if (error.code === "23505") {
      const retried = await pool.query(
        `SELECT id::text,requested_by_user_id::text FROM system_backup_jobs WHERE request_id=$1`,
        [requestId],
      );
      if (retried.rows[0]?.requested_by_user_id === String(user.id))
        return resolveRetry(retried.rows[0]);
      throw new ServiceError("BACKUP_ACTIVE", "Backup lain masih berjalan.", 409);
    }
    throw error;
  } finally {
    client.release();
  }

  try {
    const worker = spawn(process.execPath, [path.join(process.cwd(), "scripts", "run-system-backup.mjs"), id], {
      cwd: process.cwd(),
      detached: true,
      stdio: ["pipe", "ignore", "ignore"],
      windowsHide: true,
      env: { ...process.env, NODE_ENV: process.env.NODE_ENV || "production" },
    });
    await new Promise((resolve, reject) => {
      worker.once("spawn", resolve);
      worker.once("error", reject);
    });
    worker.stdin.once("error", () => {
      pool.query(
        `UPDATE system_backup_jobs SET status='failed',error_code='PASSWORD_PIPE_FAILED',
         error_message='Kata sandi tidak dapat dikirim ke proses backup. Jalankan backup baru.',completed_at=now()
         WHERE id=$1 AND status='queued'`, [id],
      ).catch(() => {});
    });
    worker.stdin.end(password + "\n");
    worker.unref();
  } catch {
    await pool.query(
      `UPDATE system_backup_jobs SET status='failed',error_code='WORKER_START_FAILED',
       error_message='Proses backup belum dapat dimulai. Periksa layanan server.',completed_at=now()
       WHERE id=$1`,
      [id],
    );
    throw new ServiceError("BACKUP_START_FAILED", "Proses backup belum dapat dimulai.", 503);
  }
  return getBackup(id);
}
