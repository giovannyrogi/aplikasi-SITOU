BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('sitou:system-backups:044', 0));
ALTER TABLE system_backup_jobs
  ADD COLUMN time_zone varchar(80) NOT NULL DEFAULT 'UTC'
    CONSTRAINT ck_system_backup_time_zone CHECK (length(btrim(time_zone)) > 0);
COMMENT ON COLUMN system_backup_jobs.time_zone IS 'Zona waktu snapshot pekerjaan untuk nama artefak dan tampilan; pekerjaan lama tetap UTC.';
COMMIT;
