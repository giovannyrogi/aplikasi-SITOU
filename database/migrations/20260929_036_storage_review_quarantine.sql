BEGIN;

ALTER TABLE stored_files
  DROP CONSTRAINT ck_stored_files_lifecycle_status,
  DROP CONSTRAINT ck_stored_files_lifecycle_consistency,
  ADD COLUMN retained_at timestamptz,
  ADD COLUMN retained_by_user_id bigint REFERENCES users(id),
  ADD COLUMN retention_reason text,
  ADD COLUMN quarantined_at timestamptz,
  ADD CONSTRAINT ck_stored_files_lifecycle_status CHECK (
    lifecycle_status IN ('draft','active','deleted','purged','retained','quarantined')
  ),
  ADD CONSTRAINT ck_stored_files_lifecycle_consistency CHECK (
    (lifecycle_status='draft' AND onboarding_draft_id IS NOT NULL
      AND draft_slot IS NOT NULL AND deleted_at IS NULL AND content_purged_at IS NULL)
    OR (lifecycle_status='active' AND deleted_at IS NULL AND content_purged_at IS NULL)
    OR (lifecycle_status='deleted' AND deleted_at IS NOT NULL AND content_purged_at IS NULL)
    OR (lifecycle_status='purged' AND deleted_at IS NOT NULL AND content_purged_at IS NOT NULL)
    OR (lifecycle_status='retained' AND deleted_at IS NOT NULL AND retained_at IS NOT NULL
      AND content_purged_at IS NULL)
    OR (lifecycle_status='quarantined' AND quarantined_at IS NOT NULL
      AND content_purged_at IS NULL)
  );

ALTER TABLE file_purge_jobs DROP CONSTRAINT file_purge_jobs_status_check;
ALTER TABLE file_purge_jobs ADD CONSTRAINT file_purge_jobs_status_check
  CHECK (status IN ('queued','processing','retry','completed','failed','cancelled'));

UPDATE file_purge_jobs job
SET status='cancelled',completed_at=now(),last_error_code='PROTECTED_OFFICIAL_HISTORY'
FROM stored_files file
WHERE file.organization_id=job.organization_id AND file.id=job.stored_file_id
  AND file.category IN ('contract','assignment_decree','discipline_letter',
    'leave_attachment','medical_letter','attendance_photo','employee_import_source')
  AND job.status IN ('queued','retry');

ALTER TABLE file_cleanup_items
  ADD COLUMN mime_type varchar(150),
  ADD COLUMN malware_scan_status varchar(24),
  ADD COLUMN malware_signature varchar(240),
  ADD COLUMN malware_scanned_at timestamptz,
  ADD COLUMN file_modified_at timestamptz;

CREATE TABLE file_quarantine_items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id bigint NOT NULL REFERENCES organizations(id),
  stored_file_id bigint,
  source_cleanup_item_id bigint REFERENCES file_cleanup_items(id) ON DELETE SET NULL,
  reason varchar(30) NOT NULL CHECK (reason IN ('filesystem_orphan','temporary_file','trash_file','malware')),
  status varchar(20) NOT NULL DEFAULT 'quarantined'
    CHECK (status IN ('quarantined','restored','purged','failed')),
  original_object_key text NOT NULL,
  quarantine_object_key text NOT NULL,
  original_name text NOT NULL,
  mime_type varchar(150),
  size_bytes bigint NOT NULL CHECK (size_bytes>=0),
  sha256 char(64) NOT NULL,
  malware_scan_status varchar(24) NOT NULL
    CHECK (malware_scan_status IN ('clean','infected','scan_error','legacy_unscanned')),
  malware_scan_engine varchar(80),
  malware_signature varchar(240),
  quarantined_by_user_id bigint REFERENCES users(id),
  quarantined_at timestamptz NOT NULL DEFAULT now(),
  purge_after timestamptz NOT NULL,
  restored_by_user_id bigint REFERENCES users(id),
  restored_at timestamptz,
  purged_by_user_id bigint REFERENCES users(id),
  purged_at timestamptz,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts>=0),
  last_error_code varchar(80),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_file_quarantine_stored_file FOREIGN KEY (organization_id,stored_file_id)
    REFERENCES stored_files(organization_id,id),
  CONSTRAINT ck_file_quarantine_keys CHECK (
    original_object_key !~ '(^/|\.\.)' AND quarantine_object_key !~ '(^/|\.\.)'
  ),
  CONSTRAINT ck_file_quarantine_result CHECK (
    (status='quarantined' AND restored_at IS NULL AND purged_at IS NULL)
    OR (status='restored' AND restored_at IS NOT NULL AND purged_at IS NULL)
    OR (status='purged' AND purged_at IS NOT NULL)
    OR status='failed'
  )
);

CREATE UNIQUE INDEX uq_file_quarantine_active_source
  ON file_quarantine_items(organization_id,original_object_key)
  WHERE status='quarantined';
CREATE UNIQUE INDEX uq_file_quarantine_active_stored_file
  ON file_quarantine_items(organization_id,stored_file_id)
  WHERE status='quarantined' AND stored_file_id IS NOT NULL;
CREATE INDEX ix_file_quarantine_due
  ON file_quarantine_items(purge_after,id) WHERE status='quarantined';
CREATE INDEX ix_file_quarantine_org_time
  ON file_quarantine_items(organization_id,quarantined_at DESC,id DESC);
CREATE TRIGGER trg_file_quarantine_items_updated_at
BEFORE UPDATE ON file_quarantine_items
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE file_quarantine_items IS
  'Karantina privat file orphan atau berbahaya dengan tenggat purge dan pemulihan yang diaudit.';
COMMENT ON COLUMN stored_files.lifecycle_status IS
  'Lifecycle byte dan metadata: draft, active, deleted, purged, retained, atau quarantined.';

COMMIT;
