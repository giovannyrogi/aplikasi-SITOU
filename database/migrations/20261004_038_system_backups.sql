BEGIN;

SELECT pg_advisory_xact_lock(hashtextextended('sitou:system-backups:038', 0));

CREATE TABLE system_backup_jobs (
  id uuid PRIMARY KEY,
  requested_by_user_id bigint NOT NULL REFERENCES users(id),
  request_id uuid NOT NULL UNIQUE,
  status varchar(24) NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','copying','securing','verifying','ready','failed','expired')),
  organization_count integer,
  file_count bigint,
  file_bytes bigint,
  package_bytes bigint,
  package_sha256 char(64),
  package_path text,
  error_code varchar(60),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz,
  CONSTRAINT ck_system_backup_ready CHECK (
    status <> 'ready' OR
    (package_path IS NOT NULL AND package_sha256 IS NOT NULL AND expires_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX uq_system_backup_active
  ON system_backup_jobs ((true))
  WHERE status IN ('queued','copying','securing','verifying');
CREATE INDEX ix_system_backup_history ON system_backup_jobs(created_at DESC,id DESC);
CREATE INDEX ix_system_backup_expiry ON system_backup_jobs(expires_at)
  WHERE status='ready';

INSERT INTO permissions(code,description)
VALUES ('system_backup.manage','Membuat, melihat, memverifikasi, dan mengunduh backup seluruh sistem.')
ON CONFLICT (code) DO UPDATE SET description=EXCLUDED.description;
INSERT INTO role_permissions(role_id,permission_id)
SELECT role.id,permission.id FROM roles role CROSS JOIN permissions permission
WHERE role.code='superadmin' AND permission.code='system_backup.manage'
ON CONFLICT DO NOTHING;

COMMIT;
