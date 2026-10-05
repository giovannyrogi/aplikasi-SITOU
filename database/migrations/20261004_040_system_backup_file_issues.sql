BEGIN;

SELECT pg_advisory_xact_lock(hashtextextended('sitou:system-backups:040', 0));

ALTER TABLE system_backup_jobs DROP CONSTRAINT system_backup_jobs_status_check;
ALTER TABLE system_backup_jobs ADD CONSTRAINT system_backup_jobs_status_check
  CHECK (status IN ('queued','copying','securing','verifying','ready','ready_with_warnings','failed','expired'));
ALTER TABLE system_backup_jobs ADD COLUMN issue_count bigint NOT NULL DEFAULT 0 CHECK (issue_count >= 0);
ALTER TABLE system_backup_jobs DROP CONSTRAINT ck_system_backup_ready;
ALTER TABLE system_backup_jobs ADD CONSTRAINT ck_system_backup_ready CHECK (
  status NOT IN ('ready','ready_with_warnings') OR
  (package_path IS NOT NULL AND package_sha256 IS NOT NULL AND expires_at IS NOT NULL)
);
DROP INDEX ix_system_backup_expiry;
CREATE INDEX ix_system_backup_expiry ON system_backup_jobs(expires_at)
  WHERE status IN ('ready','ready_with_warnings');

CREATE TABLE system_backup_file_issues (
  job_id uuid NOT NULL REFERENCES system_backup_jobs(id) ON DELETE CASCADE,
  organization_id bigint NOT NULL,
  organization_name varchar(200) NOT NULL,
  stored_file_id bigint NOT NULL,
  employee_id bigint,
  employee_name varchar(200),
  employee_no_masked varchar(80),
  file_label varchar(120) NOT NULL,
  issue_type varchar(24) NOT NULL CHECK (issue_type IN ('missing','size_mismatch','hash_mismatch')),
  priority varchar(20) NOT NULL CHECK (priority IN ('restore','cleanup_review')),
  relationships jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(relationships)='array'),
  PRIMARY KEY (job_id,stored_file_id)
);
CREATE INDEX ix_system_backup_file_issues_filters
  ON system_backup_file_issues(job_id,organization_id,priority,issue_type,stored_file_id);

COMMIT;
