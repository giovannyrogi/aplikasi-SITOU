import { readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import pg from "pg";
import {
  backupPaths,
  backupJobDirectory,
  cleanupBackupJobFiles,
} from "../lib/system-backup/paths.mjs";
import { reconcileStalledBackups } from "../lib/system-backup/health.mjs";

dotenv.config({
  path:
    process.env.ENV_FILE ||
    (process.env.NODE_ENV === "production" ? ".env.production" : ".env.development"),
  quiet: true,
});
const pool = new pg.Pool({
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  port: Number(process.env.PGPORT || 5432),
});

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
    const match =
      /^backup_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}_(?:UTC|WIB|WITA|WIT|UTC[pm]\d{4})_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(
        entry.name,
      );
    if (!entry.isDirectory() || !match) continue;
    const job = (
      await pool.query("SELECT status,created_at,time_zone FROM system_backup_jobs WHERE id=$1", [
        match[1],
      ])
    ).rows[0];
    if (
      !job ||
      path.join(backupRoot, entry.name) !==
        backupJobDirectory(backupRoot, match[1], job.created_at, job.time_zone)
    )
      continue;
    if (
      job.status !== "deleted" &&
      Date.now() - new Date(job.created_at).getTime() < 60 * 60 * 1000
    )
      continue;
    const kinds = ["failed", "expired", "deleted"].includes(job.status)
      ? ["package", "database_zip", "uploads_zip"]
      : [];
    if (["ready", "ready_with_warnings"].includes(job.status)) {
      const artifacts = (
        await pool.query("SELECT kind,status FROM system_backup_artifacts WHERE job_id=$1", [
          match[1],
        ])
      ).rows;
      for (const artifact of artifacts)
        if (["failed", "deleted"].includes(artifact.status)) kinds.push(artifact.kind);
    }
    if (kinds.length)
      try {
        await cleanupBackupJobFiles(backupRoot, match[1], job.created_at, kinds, job.time_zone);
      } catch (error) {
        console.warn("[system_backup.cleanup_pending]", {
          jobId: match[1],
          code: error.code || "REMOVE_FAILED",
        });
      }
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
    const job = (
      await pool.query(`SELECT status FROM system_backup_jobs WHERE id=$1`, [
        entry.name.slice(0, 36),
      ])
    ).rows[0];
    if (
      !job ||
      ["ready", "ready_with_warnings", "failed", "expired", "deleted"].includes(job.status)
    )
      await rm(target, { recursive: true, force: true });
  }
}

try {
  do {
    await expire();
    if (process.argv.includes("--once")) break;
    await new Promise((resolve) => setTimeout(resolve, 60_000));
  } while (true);
} finally {
  await pool.end();
}
