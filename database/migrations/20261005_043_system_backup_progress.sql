BEGIN;

SELECT pg_advisory_xact_lock(hashtextextended('sitou:system-backups:043', 0));

ALTER TABLE system_backup_jobs
  ADD COLUMN progress_stage varchar(32),
  ADD COLUMN progress_done bigint NOT NULL DEFAULT 0 CHECK (progress_done >= 0),
  ADD COLUMN progress_total bigint CHECK (progress_total IS NULL OR progress_total >= 0),
  ADD COLUMN progress_unit varchar(8) CHECK (progress_unit IS NULL OR progress_unit IN ('files','bytes')),
  ADD COLUMN progress_category varchar(32),
  ADD COLUMN progress_updated_at timestamptz;

ALTER TABLE system_backup_artifacts
  ADD COLUMN progress_done bigint NOT NULL DEFAULT 0 CHECK (progress_done >= 0),
  ADD COLUMN progress_total bigint CHECK (progress_total IS NULL OR progress_total >= 0),
  ADD COLUMN progress_updated_at timestamptz;

COMMIT;
