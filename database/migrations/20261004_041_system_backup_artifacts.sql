BEGIN;

SELECT pg_advisory_xact_lock(hashtextextended('sitou:system-backups:041', 0));

CREATE TABLE system_backup_artifacts (
  job_id uuid NOT NULL REFERENCES system_backup_jobs(id) ON DELETE CASCADE,
  kind varchar(20) NOT NULL CHECK (kind IN ('database_zip','uploads_zip')),
  status varchar(16) NOT NULL CHECK (status IN ('pending','creating','ready','failed','expired')),
  size_bytes bigint CHECK (size_bytes >= 0),
  sha256 char(64),
  internal_path text,
  error_message text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (job_id,kind),
  CONSTRAINT ck_system_backup_artifact_ready CHECK (
    status <> 'ready' OR (size_bytes IS NOT NULL AND sha256 IS NOT NULL AND internal_path IS NOT NULL)
  )
);
CREATE INDEX ix_system_backup_artifacts_status ON system_backup_artifacts(status,updated_at);

COMMIT;
