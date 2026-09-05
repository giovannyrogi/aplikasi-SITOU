BEGIN;

ALTER TABLE stored_files
  ADD COLUMN deleted_by_user_id bigint REFERENCES users(id),
  ADD COLUMN deletion_reason_code varchar(40),
  ADD COLUMN content_purged_at timestamptz;

UPDATE stored_files
SET deletion_reason_code='legacy_unknown'
WHERE deleted_at IS NOT NULL AND deletion_reason_code IS NULL;

CREATE TABLE file_cleanup_runs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id bigint NOT NULL REFERENCES organizations(id),
  run_type varchar(20) NOT NULL CHECK (run_type IN ('scan','cleanup')),
  source_scan_run_id bigint REFERENCES file_cleanup_runs(id),
  status varchar(20) NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','running','completed','partial','failed','cancelled')),
  requested_by_user_id bigint NOT NULL REFERENCES users(id),
  total_items integer NOT NULL DEFAULT 0 CHECK (total_items>=0),
  candidate_items integer NOT NULL DEFAULT 0 CHECK (candidate_items>=0),
  issue_items integer NOT NULL DEFAULT 0 CHECK (issue_items>=0),
  selected_items integer NOT NULL DEFAULT 0 CHECK (selected_items>=0),
  cleaned_items integer NOT NULL DEFAULT 0 CHECK (cleaned_items>=0),
  skipped_items integer NOT NULL DEFAULT 0 CHECK (skipped_items>=0),
  failed_items integer NOT NULL DEFAULT 0 CHECK (failed_items>=0),
  candidate_bytes bigint NOT NULL DEFAULT 0 CHECK (candidate_bytes>=0),
  cleaned_bytes bigint NOT NULL DEFAULT 0 CHECK (cleaned_bytes>=0),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts>=0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  last_error_code varchar(80),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_file_cleanup_runs_org_id UNIQUE (organization_id,id),
  CONSTRAINT fk_file_cleanup_source_scan
    FOREIGN KEY (organization_id,source_scan_run_id)
    REFERENCES file_cleanup_runs(organization_id,id),
  CONSTRAINT ck_file_cleanup_source
    CHECK ((run_type='scan' AND source_scan_run_id IS NULL)
      OR (run_type='cleanup' AND source_scan_run_id IS NOT NULL))
);

CREATE INDEX ix_file_cleanup_runs_queue
ON file_cleanup_runs(next_attempt_at,id)
WHERE status='queued';

CREATE UNIQUE INDEX uq_file_cleanup_runs_active_org
ON file_cleanup_runs(organization_id)
WHERE status IN ('queued','running');

CREATE INDEX ix_file_cleanup_runs_org_time
ON file_cleanup_runs(organization_id,created_at DESC,id DESC);

CREATE TABLE file_cleanup_items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id bigint NOT NULL,
  run_id bigint NOT NULL,
  stored_file_id bigint NOT NULL,
  item_kind varchar(20) NOT NULL CHECK (item_kind IN ('candidate','issue')),
  status varchar(30) NOT NULL
    CHECK (status IN ('eligible','selected','needs_review','already_absent','queued','processing','cleaned','skipped','failed','pending_retry')),
  reason_code varchar(80) NOT NULL,
  reference_labels text[] NOT NULL DEFAULT '{}',
  category varchar(40) NOT NULL,
  size_bytes bigint NOT NULL DEFAULT 0 CHECK (size_bytes>=0),
  quarantine_key text,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts>=0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error_code varchar(80),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_file_cleanup_item UNIQUE (run_id,stored_file_id),
  CONSTRAINT fk_file_cleanup_item_run
    FOREIGN KEY (organization_id,run_id)
    REFERENCES file_cleanup_runs(organization_id,id) ON DELETE CASCADE,
  CONSTRAINT fk_file_cleanup_item_file
    FOREIGN KEY (organization_id,stored_file_id)
    REFERENCES stored_files(organization_id,id)
);

CREATE INDEX ix_file_cleanup_items_run_status
ON file_cleanup_items(run_id,status,id);

CREATE INDEX ix_stored_files_cleanup_candidates
ON stored_files(organization_id,deleted_at,id)
WHERE deleted_at IS NOT NULL
  AND content_purged_at IS NULL
  AND category IN ('employee_photo','identity','education');

CREATE TRIGGER trg_file_cleanup_runs_updated_at
BEFORE UPDATE ON file_cleanup_runs
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_file_cleanup_items_updated_at
BEFORE UPDATE ON file_cleanup_items
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO permissions(code,description)
VALUES ('storage_maintenance.manage','Memeriksa dan membersihkan byte file profil yang tidak lagi digunakan.')
ON CONFLICT (code) DO UPDATE SET description=EXCLUDED.description;

INSERT INTO role_permissions(role_id,permission_id)
SELECT role.id,permission.id
FROM roles role
CROSS JOIN permissions permission
WHERE role.code='superadmin' AND permission.code='storage_maintenance.manage'
ON CONFLICT DO NOTHING;

COMMIT;
