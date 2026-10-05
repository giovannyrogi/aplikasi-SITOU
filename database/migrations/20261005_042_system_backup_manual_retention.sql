BEGIN;

SELECT pg_advisory_xact_lock(hashtextextended('sitou:system-backups:042', 0));

ALTER TABLE system_backup_jobs DROP CONSTRAINT system_backup_jobs_status_check;
ALTER TABLE system_backup_jobs ADD CONSTRAINT system_backup_jobs_status_check
  CHECK (status IN ('queued','copying','securing','verifying','ready','ready_with_warnings','failed','expired','deleted'));
ALTER TABLE system_backup_jobs DROP CONSTRAINT ck_system_backup_ready;
ALTER TABLE system_backup_jobs ADD CONSTRAINT ck_system_backup_ready CHECK (
  status NOT IN ('ready','ready_with_warnings') OR
  (package_path IS NOT NULL AND package_sha256 IS NOT NULL)
);
ALTER TABLE system_backup_jobs ADD COLUMN deleted_at timestamptz;
ALTER TABLE system_backup_jobs ADD COLUMN deleted_by_user_id bigint REFERENCES users(id);
ALTER TABLE system_backup_jobs ADD CONSTRAINT ck_system_backup_deleted CHECK (
  status <> 'deleted' OR (deleted_at IS NOT NULL AND deleted_by_user_id IS NOT NULL)
);
UPDATE system_backup_jobs SET expires_at=NULL WHERE status IN ('ready','ready_with_warnings');
DROP INDEX IF EXISTS ix_system_backup_expiry;

ALTER TABLE system_backup_artifacts DROP CONSTRAINT system_backup_artifacts_status_check;
ALTER TABLE system_backup_artifacts ADD CONSTRAINT system_backup_artifacts_status_check
  CHECK (status IN ('pending','creating','ready','failed','expired','deleted'));

UPDATE permissions SET description='Membuat, melihat, memverifikasi, mengunduh, dan menghapus paket backup seluruh sistem.'
WHERE code='system_backup.manage';

COMMIT;
