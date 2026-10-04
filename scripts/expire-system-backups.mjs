import { readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import pg from "pg";
import { backupPaths, packagePath } from "../lib/system-backup/paths.mjs";

dotenv.config({ path: process.env.ENV_FILE || (process.env.NODE_ENV === "production" ? ".env.production" : ".env.development"), quiet: true });
const pool = new pg.Pool({ user: process.env.PGUSER, password: process.env.PGPASSWORD,
  host: process.env.PGHOST, database: process.env.PGDATABASE, port: Number(process.env.PGPORT || 5432) });

/** Hanya nama paket yang diturunkan dari UUID internal boleh dihapus. */
async function expire() {
  const { backupRoot, snapshotRoot } = backupPaths();
  const result = await pool.query(
    `SELECT id::text FROM system_backup_jobs WHERE status='ready' AND expires_at<=now() ORDER BY expires_at LIMIT 100`);
  for (const job of result.rows) {
    await rm(packagePath(backupRoot, job.id), { force: true });
    await pool.query(`UPDATE system_backup_jobs SET status='expired',package_path=NULL WHERE id=$1 AND status='ready'`, [job.id]);
  }
  await pool.query(
    `UPDATE system_backup_jobs SET status='failed',completed_at=now(),
      error_code='WORKER_INTERRUPTED',error_message='Proses backup terputus. Jalankan backup baru.'
     WHERE status IN ('queued','copying','securing','verifying')
       AND COALESCE(heartbeat_at,created_at)<now()-interval '10 minutes'`);
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
    if (!job || ["failed", "expired"].includes(job.status))
      await rm(target, { force: true });
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
    if (!job || ["ready", "failed", "expired"].includes(job.status))
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
