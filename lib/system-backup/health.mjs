/** Rekonsiliasi aman dan idempotent, termasuk ketika worker pemeliharaan VPS sedang mati. */
export async function reconcileStalledBackups(pool) {
  const stale = await pool.query(`SELECT 1 FROM system_backup_jobs
    WHERE (status='queued' AND started_at IS NULL AND created_at<now()-interval '90 seconds')
       OR (status IN ('queued','copying','securing','verifying')
         AND COALESCE(heartbeat_at,created_at)<now()-interval '10 minutes') LIMIT 1`);
  if (!stale.rowCount) return 0;
  const result = await pool.query(`UPDATE system_backup_jobs SET status='failed',completed_at=now(),
    error_code=CASE WHEN status='queued' AND started_at IS NULL
      THEN 'WORKER_START_TIMEOUT' ELSE 'WORKER_INTERRUPTED' END,
    error_message=CASE WHEN status='queued' AND started_at IS NULL
      THEN 'Proses backup tidak mulai. Periksa layanan aplikasi, lalu buat backup baru.'
      ELSE 'Proses backup tidak merespons. Periksa layanan server, lalu buat backup baru.' END
    WHERE (status='queued' AND started_at IS NULL AND created_at<now()-interval '90 seconds')
       OR (status IN ('queued','copying','securing','verifying')
         AND COALESCE(heartbeat_at,created_at)<now()-interval '10 minutes')`);
  return result.rowCount;
}
