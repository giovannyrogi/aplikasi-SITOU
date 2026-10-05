import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { opendir, statfs, lstat, rm } from "node:fs/promises";
import path from "node:path";
import pool from "@/lib/dbConfig";
import { writeAudit } from "@/lib/audit";
import { ServiceError } from "@/lib/api/routeHelpers";
import { artifactPath, backupPaths, packagePath } from "./paths.mjs";
import { stagePercent } from "./progress.mjs";
import { reconcileStalledBackups } from "./health.mjs";

const JOB_FIELDS = `id::text,status,organization_count,file_count,issue_count,file_bytes,package_bytes,
  package_sha256,created_at,started_at,completed_at,expires_at,deleted_at,
  deleted_by_user_id::text,error_code,error_message,
  progress_stage,progress_done,progress_total,progress_unit,progress_category,progress_updated_at,
  requested_by_user_id::text,
  COALESCE((SELECT jsonb_object_agg(a.kind,jsonb_build_object('status',a.status,
    'sizeBytes',a.size_bytes,'sha256',a.sha256,'errorMessage',a.error_message,
    'progressDone',a.progress_done,'progressTotal',a.progress_total,
    'progressUpdatedAt',a.progress_updated_at))
    FROM system_backup_artifacts a WHERE a.job_id=system_backup_jobs.id),'{}'::jsonb) AS artifacts,
  (SELECT display_name FROM v_user_identity WHERE user_id=deleted_by_user_id LIMIT 1) AS deleted_by_name,
  (SELECT display_name FROM v_user_identity WHERE user_id=requested_by_user_id LIMIT 1) AS requested_by_name`;

function publicJob(row) {
  const { progress_stage, progress_done, progress_total, progress_unit,
    progress_category, progress_updated_at, ...rest } = row;
  return { ...rest, progress: {
    stage: progress_stage || (row.status === "queued" ? "queued" : null),
    done: Number(progress_done || 0), total: progress_total == null ? null : Number(progress_total),
    unit: progress_unit, category: progress_category,
    updatedAt: progress_updated_at,
    needsAttention: ["queued", "copying", "securing", "verifying"].includes(row.status) &&
      Date.now() - new Date(progress_updated_at || row.created_at).getTime() > 3 * 60_000,
    percent: stagePercent(progress_done, progress_total, ["ready", "ready_with_warnings"].includes(row.status) && progress_stage === "complete"),
  } };
}

/** Histori bertahan tanpa batas; keyset menjaga halaman tetap kecil saat jumlah backup tumbuh. */
export async function listBackups(cursor) {
  await reconcileStalledBackups(pool);
  let after = null;
  if (cursor) {
    try {
      if (cursor.length > 512) throw new Error("Cursor terlalu panjang.");
      after = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
      if (!Number.isFinite(Date.parse(after.createdAt)) ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(after.id))
        throw new Error("Cursor tidak valid.");
    } catch { throw new ServiceError("BACKUP_CURSOR_INVALID", "Halaman riwayat tidak valid. Muat ulang daftar.", 400); }
  }
  const result = await pool.query(`SELECT ${JOB_FIELDS} FROM system_backup_jobs
    WHERE ($1::timestamptz IS NULL OR (created_at,id)<($1::timestamptz,$2::uuid))
    ORDER BY created_at DESC,id DESC LIMIT 26`, [after?.createdAt || null, after?.id || null]);
  const rows = result.rows.slice(0, 25);
  return { rows: rows.map(publicJob), nextCursor: result.rows.length > 25 ? Buffer.from(JSON.stringify({
    createdAt: rows.at(-1).created_at, id: rows.at(-1).id,
  })).toString("base64url") : null };
}

/** Detail pekerjaan dibaca tanpa membuka path internal paket. */
export async function getBackup(id) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
    throw new ServiceError("BACKUP_ID_INVALID", "ID backup tidak valid.", 400);
  await reconcileStalledBackups(pool);
  const result = await pool.query(`SELECT ${JOB_FIELDS} FROM system_backup_jobs WHERE id=$1::uuid`, [id]);
  if (!result.rows[0]) throw new ServiceError("BACKUP_NOT_FOUND", "Backup tidak ditemukan.", 404);
  return publicJob(result.rows[0]);
}

/** Temuan dibatasi satu pekerjaan dan hanya berisi snapshot metadata aman. */
export async function listBackupIssues(id, { organizationId, priority, issueType, cursor, limit = 25 } = {}) {
  await getBackup(id);
  let afterId = null;
  if (cursor) {
    try {
      const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
      if (parsed.jobId !== id || parsed.organizationId !== (organizationId || null) ||
          parsed.priority !== (priority || null) || parsed.issueType !== (issueType || null) ||
          !/^[1-9]\d{0,18}$/.test(parsed.afterId) ||
          BigInt(parsed.afterId) > 9223372036854775807n) throw new Error("Cursor berubah.");
      afterId = parsed.afterId;
    } catch {
      throw new ServiceError("BACKUP_ISSUE_CURSOR_INVALID", "Halaman temuan tidak valid. Muat ulang daftar.", 400);
    }
  }
  const [result, organizations] = await Promise.all([pool.query(
    `SELECT organization_id::text,organization_name,stored_file_id::text,employee_id::text,
       employee_name,employee_no_masked,file_label,issue_type,priority,relationships
     FROM system_backup_file_issues WHERE job_id=$1::uuid
       AND ($2::bigint IS NULL OR organization_id=$2::bigint)
       AND ($3::varchar IS NULL OR priority=$3::varchar)
       AND ($4::varchar IS NULL OR issue_type=$4::varchar)
       AND ($5::bigint IS NULL OR stored_file_id>$5::bigint)
     ORDER BY stored_file_id LIMIT $6`,
    [id, organizationId || null, priority || null, issueType || null, afterId, limit + 1],
  ), pool.query(`SELECT DISTINCT organization_id::text AS id,organization_name AS name
    FROM system_backup_file_issues WHERE job_id=$1::uuid ORDER BY name,id`, [id])]);
  const rows = result.rows.slice(0, limit);
  const nextCursor = result.rows.length > limit ? Buffer.from(JSON.stringify({ jobId: id,
    organizationId: organizationId || null, priority: priority || null,
    issueType: issueType || null, afterId: rows.at(-1).stored_file_id })).toString("base64url") : null;
  return { rows, nextCursor, organizations: organizations.rows };
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
    databaseBytes: Number(database.rows[0].bytes),
    requiredTemporaryBytes: 4 * (Number(database.rows[0].bytes) + files.bytes), freeBytes };
}

/** Kata sandi hanya dikirim melalui stdin child process; tidak masuk database, argv, atau log. */
export async function createBackup({ user, password, requestId }) {
  backupPaths();
  const resolveRetry = async (record) => {
    if (record.requested_by_user_id !== String(user.id))
      throw new ServiceError("REQUEST_ID_USED", "ID permintaan sudah digunakan.", 409);
    const job = await getBackup(record.id);
    if (["failed", "expired", "deleted"].includes(job.status))
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
      stdio: ["pipe", "ignore", "ignore", "ipc"],
      windowsHide: true,
      env: { ...process.env, NODE_ENV: process.env.NODE_ENV || "production" },
    });
    worker.stdin.once("error", () => {
      pool.query(
        `UPDATE system_backup_jobs SET status='failed',error_code='PASSWORD_PIPE_FAILED',
         error_message='Kata sandi tidak dapat dikirim ke proses backup. Jalankan backup baru.',completed_at=now()
         WHERE id=$1 AND status='queued'`, [id],
      ).catch(() => {});
    });
    worker.stdin.end(password + "\n");
    await new Promise((resolve, reject) => {
      let acknowledged = false;
      const timer = setTimeout(() => {
        worker.kill();
        reject(new ServiceError("BACKUP_WORKER_TIMEOUT", "Proses backup tidak mulai. Periksa layanan server.", 503));
      }, 30_000);
      worker.once("message", (message) => {
        if (message?.type !== "backup-started" || acknowledged) return;
        acknowledged = true;
        clearTimeout(timer);
        worker.disconnect();
        resolve();
      });
      worker.once("error", (error) => { clearTimeout(timer); reject(error); });
      worker.once("exit", () => {
        clearTimeout(timer);
        if (!acknowledged) reject(new Error("Proses backup berhenti sebelum dimulai."));
        else pool.query(`UPDATE system_backup_jobs SET status='failed',completed_at=now(),
          error_code='WORKER_INTERRUPTED',
          error_message='Proses backup terhenti. Jalankan backup baru.'
          WHERE id=$1 AND status IN ('queued','copying','securing','verifying')`, [id]).catch(() => {});
      });
    });
    worker.unref();
  } catch (error) {
    await pool.query(
      `UPDATE system_backup_jobs SET status='failed',error_code='WORKER_START_FAILED',
       error_message='Proses backup belum dapat dimulai. Periksa layanan server.',completed_at=now()
       WHERE id=$1 AND status IN ('queued','copying','securing','verifying')`,
      [id],
    );
    throw error instanceof ServiceError ? error :
      new ServiceError("BACKUP_START_FAILED", "Proses backup belum dapat dimulai.", 503);
  }
  return getBackup(id);
}

/** Membuat ulang satu ZIP dari paket terenkripsi yang sama, tanpa snapshot database baru. */
export async function retryBackupArtifact({ id, kind, user, password, requestId }) {
  await getBackup(id);
  if (!["database_zip", "uploads_zip"].includes(kind))
    throw new ServiceError("BACKUP_ARTIFACT_INVALID", "Jenis unduhan tidak valid.", 400);
  const claimed = await pool.query(`UPDATE system_backup_artifacts a SET status='creating',
    error_message=NULL,progress_done=0,progress_total=NULL,
    progress_updated_at=NULL,updated_at=now() FROM system_backup_jobs j
    WHERE a.job_id=j.id AND j.id=$1::uuid AND a.kind=$2 AND a.status='failed'
      AND j.status IN ('ready','ready_with_warnings')
    RETURNING a.kind`, [id, kind]);
  if (!claimed.rowCount)
    throw new ServiceError("BACKUP_ARTIFACT_RETRY_INVALID", "ZIP tidak dapat dicoba ulang. Periksa status paket utama.", 409);
  try {
    const client = await pool.connect();
    try { await writeAudit(client, { actorUserId: user.id, action: "system_backup.artifact_retry_requested",
      entityType: "system_backup_job", entityId: id, requestId, afterData: { kind } }); }
    finally { client.release(); }
    const child = spawn(process.execPath,
      [path.join(process.cwd(), "scripts", "retry-system-backup-artifact.mjs"), id, kind],
      { cwd: process.cwd(), detached: true, stdio: ["pipe", "ignore", "ignore"],
        windowsHide: true, env: { ...process.env, NODE_ENV: process.env.NODE_ENV || "production" } });
    await new Promise((resolve, reject) => { child.once("spawn", resolve); child.once("error", reject); });
    child.stdin.once("error", () => pool.query(`UPDATE system_backup_artifacts SET status='failed',
      error_message='Kata sandi tidak dapat dikirim ke proses ZIP.',updated_at=now()
      WHERE job_id=$1 AND kind=$2 AND status='creating'`, [id, kind]).catch(() => {}));
    child.stdin.end(password + "\n");
    child.unref();
  } catch {
    await pool.query(`UPDATE system_backup_artifacts SET status='failed',
      error_message='Proses ZIP belum dapat dimulai.',updated_at=now() WHERE job_id=$1 AND kind=$2`, [id, kind]);
    throw new ServiceError("BACKUP_ARTIFACT_START_FAILED", "ZIP belum dapat dibuat. Coba lagi.", 503);
  }
  return getBackup(id);
}

/** Memutus akses paket dalam transaksi, lalu membersihkan tiga path turunan UUID saja. */
export async function deleteBackupFiles({ id, user, requestId }) {
  await getBackup(id);
  const { backupRoot } = backupPaths();
  const expectedPackage = packagePath(backupRoot, id);
  const kinds = ["database_zip", "uploads_zip"];
  const client = await pool.connect();
  let alreadyDeleted = false;
  try {
    await client.query("BEGIN");
    const result = await client.query(`SELECT status,package_path FROM system_backup_jobs
      WHERE id=$1::uuid FOR UPDATE`, [id]);
    const job = result.rows[0];
    if (!job) throw new ServiceError("BACKUP_NOT_FOUND", "Backup tidak ditemukan.", 404);
    if (job.status === "deleted") alreadyDeleted = true;
    else {
      if (!["ready", "ready_with_warnings"].includes(job.status))
        throw new ServiceError("BACKUP_DELETE_INVALID", "Hanya backup yang sudah siap dapat dihapus.", 409);
      if (job.package_path !== expectedPackage)
        throw new ServiceError("BACKUP_PATH_INVALID", "Lokasi paket backup tidak valid. Hubungi administrator server.", 503);
      const artifacts = await client.query(`SELECT kind,status,internal_path FROM system_backup_artifacts
        WHERE job_id=$1::uuid FOR UPDATE`, [id]);
      if (artifacts.rows.some((artifact) => ["pending", "creating"].includes(artifact.status)))
        throw new ServiceError("BACKUP_ARTIFACT_ACTIVE", "Tunggu pembuatan ZIP selesai sebelum menghapus backup.", 409);
      if (artifacts.rows.some((artifact) => artifact.status === "ready" &&
          artifact.internal_path !== artifactPath(backupRoot, id, artifact.kind)))
        throw new ServiceError("BACKUP_PATH_INVALID", "Lokasi ZIP backup tidak valid. Hubungi administrator server.", 503);
      await client.query(`UPDATE system_backup_jobs SET status='deleted',package_path=NULL,
        deleted_at=now(),deleted_by_user_id=$2 WHERE id=$1::uuid`, [id, user.id]);
      await client.query(`UPDATE system_backup_artifacts SET status='deleted',internal_path=NULL,
        updated_at=now() WHERE job_id=$1::uuid`, [id]);
      await writeAudit(client, { actorUserId: user.id, action: "system_backup.deleted",
        entityType: "system_backup_job", entityId: id, requestId,
        afterData: { backupId: id, artifactKinds: kinds } });
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally { client.release(); }

  let cleanupPending = false;
  for (const target of [expectedPackage, ...kinds.map((kind) => artifactPath(backupRoot, id, kind))]) {
    try { await rm(target, { force: true }); }
    catch (error) {
      cleanupPending = true;
      console.warn("[system_backup.delete_cleanup_pending]", { jobId: id, code: error.code || "REMOVE_FAILED" });
    }
  }
  return { job: await getBackup(id), cleanupPending, alreadyDeleted };
}
