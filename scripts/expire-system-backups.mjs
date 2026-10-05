import { readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import pg from "pg";
import { artifactPath, backupPaths, packagePath } from "../lib/system-backup/paths.mjs";
import { reconcileStalledBackups } from "../lib/system-backup/health.mjs";

dotenv.config({ path: process.env.ENV_FILE || (process.env.NODE_ENV === "production" ? ".env.production" : ".env.development"), quiet: true });
const pool = new pg.Pool({ user: process.env.PGUSER, password: process.env.PGPASSWORD,
  host: process.env.PGHOST, database: process.env.PGDATABASE, port: Number(process.env.PGPORT || 5432) });

/** Backup siap tetap disimpan; worker hanya membersihkan sisa gagal/dihapus dan pekerjaan macet. */
async function expire() {
  const { backupRoot, snapshotRoot } = backupPaths();
  await reconcileStalledBackups(pool);
  await pool.query(`UPDATE system_backup_artifacts SET status='failed',
    error_message='Pembuatan ZIP terputus. Coba lagi.',updated_at=now()
    WHERE status IN ('pending','creating') AND updated_at<now()-interval '30 minutes'`);
  const packages = await readdir(backupRoot, { withFileTypes: true }).catch((error) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  for (const entry of packages) {
    const match = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.sitou-backup$/i.exec(entry.name);
    if (!entry.isFile() || !match) continue;
    const target = packagePath(backupRoot, match[1]);
    if (Date.now() - (await stat(target)).mtimeMs < 60 * 60 * 1000) continue;
    const job = (await pool.query(`SELECT status FROM system_backup_jobs WHERE id=$1`, [match[1]])).rows[0];
    if (!job || ["failed", "expired", "deleted"].includes(job.status))
      await rm(target, { force: true });
  }
  for (const entry of packages) {
    const match = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-(database_zip|uploads_zip)\.zip$/i.exec(entry.name);
    if (!entry.isFile() || !match) continue;
    const target = artifactPath(backupRoot, match[1], match[2]);
    if (Date.now() - (await stat(target)).mtimeMs < 60 * 60 * 1000) continue;
    const artifact = (await pool.query(`SELECT a.status,j.status AS job_status FROM system_backup_artifacts a
      JOIN system_backup_jobs j ON j.id=a.job_id WHERE a.job_id=$1 AND a.kind=$2`, [match[1],match[2]])).rows[0];
    if (!artifact || ["failed", "expired", "deleted"].includes(artifact.status) ||
        ["failed", "expired", "deleted"].includes(artifact.job_status)) await rm(target, { force: true });
  }
  // Snapshot yang ditinggal proses mati tidak boleh menyimpan hardlink privat selamanya.
  const entries = await readdir(snapshotRoot, { withFileTypes: true }).catch((error) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  for (const entry of entries) {
    if (!entry.isDirectory() || !/^[0-9a-f-]{36}-[A-Za-z0-9]+$/i.test(entry.name)) continue;
    const target = path.resolve(snapshotRoot, entry.name);
    if (!target.startsWith(snapshotRoot + path.sep)) continue;
    if (Date.now() - (await stat(target)).mtimeMs <= 60 * 60 * 1000) continue;
    const job = (await pool.query(`SELECT status FROM system_backup_jobs WHERE id=$1`, [entry.name.slice(0, 36)])).rows[0];
    if (!job || ["ready", "ready_with_warnings", "failed", "expired", "deleted"].includes(job.status))
      await rm(target, { recursive: true, force: true });
  }
}

try {
  do {
    await expire();
    if (process.argv.includes("--once")) break;
    await new Promise((resolve) => setTimeout(resolve, 60_000));
  } while (true);
} finally { await pool.end(); }
