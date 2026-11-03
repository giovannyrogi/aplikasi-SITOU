-- Platform documents are an explicit, narrow exception to organization-owned files.
ALTER TABLE stored_files ADD COLUMN ownership_scope varchar(20) NOT NULL DEFAULT 'organization';
ALTER TABLE stored_files ALTER COLUMN organization_id DROP NOT NULL;
ALTER TABLE stored_files DROP CONSTRAINT ck_stored_files_category;
ALTER TABLE stored_files ADD CONSTRAINT ck_stored_files_category CHECK (category IN ('logo','employee_photo','attendance_photo','medical_letter','leave_attachment','contract','assignment_decree','discipline_letter','identity','education','employee_import_source','other','inventory_item_photo','inventory_transaction_attachment','holiday_catalog_source'));
ALTER TABLE stored_files ADD CONSTRAINT ck_stored_files_ownership CHECK (
 (ownership_scope='organization' AND organization_id IS NOT NULL AND category<>'holiday_catalog_source') OR
 (ownership_scope='platform' AND organization_id IS NULL AND employee_id IS NULL AND onboarding_draft_id IS NULL AND category='holiday_catalog_source')
);
CREATE TABLE holiday_pdf_imports (
 id uuid PRIMARY KEY,
 actor_user_id bigint NOT NULL REFERENCES users(id),
 request_key uuid NOT NULL,
 year integer NOT NULL CHECK(year BETWEEN 2000 AND 2200),
 file_id bigint NOT NULL REFERENCES stored_files(id),
 status varchar(20) NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','ready','incomplete','failed','expired')),
 stage varchar(40) NOT NULL DEFAULT 'checking',
 progress integer NOT NULL DEFAULT 0 CHECK(progress BETWEEN 0 AND 100),
 attempts integer NOT NULL DEFAULT 0,
 worker_token uuid,
 heartbeat_at timestamptz,
 next_attempt_at timestamptz NOT NULL DEFAULT now(),
 parser_version varchar(40),
 result jsonb,
 error_code varchar(80),
 created_at timestamptz NOT NULL DEFAULT now(),
 completed_at timestamptz,
 UNIQUE(actor_user_id,request_key)
);
CREATE INDEX ix_holiday_pdf_queue ON holiday_pdf_imports(next_attempt_at,created_at) WHERE status='queued';
ALTER TABLE holiday_catalogs ADD COLUMN source_file_id bigint REFERENCES stored_files(id);
ALTER TABLE holiday_catalogs ADD COLUMN pdf_import_id uuid REFERENCES holiday_pdf_imports(id);
ALTER TABLE holiday_catalogs ADD COLUMN pdf_review jsonb;
ALTER TABLE holiday_catalogs ADD CONSTRAINT ck_holiday_pdf_reference CHECK ((pdf_import_id IS NULL AND source_file_id IS NULL AND pdf_review IS NULL) OR (pdf_import_id IS NOT NULL AND source_file_id IS NOT NULL AND pdf_review IS NOT NULL));
COMMENT ON TABLE holiday_pdf_imports IS 'Global Admin SITOU PDF extraction queue; uploaded content is untrusted and never publishes a catalog automatically.';

ALTER TABLE system_backup_file_issues ALTER COLUMN organization_id DROP NOT NULL;
ALTER TABLE system_backup_file_issues ADD CONSTRAINT ck_backup_issue_platform CHECK(organization_id IS NOT NULL OR (organization_name='Platform SITOU' AND employee_id IS NULL));

DROP INDEX ix_stored_files_cleanup_candidates;
CREATE INDEX ix_stored_files_cleanup_candidates ON stored_files(organization_id,deleted_at,id) WHERE lifecycle_status='deleted' AND content_purged_at IS NULL;
