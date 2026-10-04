BEGIN;

SELECT pg_advisory_xact_lock(hashtextextended('sitou:system-backups:039', 0));

ALTER TABLE system_backup_jobs
  ADD COLUMN heartbeat_at timestamptz;

CREATE INDEX ix_system_backup_stale ON system_backup_jobs(heartbeat_at)
  WHERE status IN ('queued','copying','securing','verifying');

COMMIT;
