BEGIN;

DO $$
DECLARE total_files bigint; active_files bigint; deleted_files bigint; draft_files bigint;
BEGIN
  SELECT count(*),count(*) FILTER (WHERE deleted_at IS NULL),
    count(*) FILTER (WHERE deleted_at IS NOT NULL),
    count(*) FILTER (WHERE onboarding_draft_id IS NOT NULL AND deleted_at IS NULL)
  INTO total_files,active_files,deleted_files,draft_files FROM stored_files;
  RAISE NOTICE 'File sebelum migration 031: total=%, aktif=%, deleted=%, draft=%',
    total_files,active_files,deleted_files,draft_files;
END $$;

ALTER TABLE stored_files DROP CONSTRAINT ck_stored_files_category;
ALTER TABLE stored_files ADD CONSTRAINT ck_stored_files_category CHECK (
  category IN ('logo','employee_photo','attendance_photo','medical_letter','leave_attachment',
    'contract','assignment_decree','discipline_letter','identity','education',
    'employee_import_source','other')
);

ALTER TABLE stored_files
  ADD COLUMN lifecycle_status varchar(20),
  ADD COLUMN draft_slot varchar(100);

UPDATE stored_files file
SET lifecycle_status=CASE
  WHEN file.content_purged_at IS NOT NULL THEN 'purged'
  WHEN file.deleted_at IS NOT NULL THEN 'deleted'
  WHEN file.onboarding_draft_id IS NOT NULL THEN 'draft'
  ELSE 'active'
END;

UPDATE stored_files
SET deleted_at=COALESCE(deleted_at,now())
WHERE lifecycle_status='purged';

UPDATE stored_files
SET draft_slot=CASE
  WHEN category='employee_photo' THEN 'profile_photo'
  WHEN category='identity' THEN 'ktp'
  WHEN category='contract' THEN 'contract'
  WHEN category='assignment_decree' THEN 'assignment_decree'
  WHEN category='education' THEN 'education:legacy:'||id::text
  ELSE category||':legacy:'||id::text
END
WHERE onboarding_draft_id IS NOT NULL AND draft_slot IS NULL;

UPDATE stored_files file
SET lifecycle_status='deleted',deleted_at=COALESCE(file.deleted_at,now()),
  deletion_reason_code=COALESCE(file.deletion_reason_code,
    CASE WHEN draft.status='expired' THEN 'draft_expired' ELSE 'draft_discarded' END)
FROM employee_onboarding_drafts draft
WHERE file.organization_id=draft.organization_id AND file.onboarding_draft_id=draft.id
  AND file.lifecycle_status='draft' AND draft.status IN ('expired','discarded');

ALTER TABLE stored_files
  ALTER COLUMN lifecycle_status SET NOT NULL,
  ALTER COLUMN lifecycle_status SET DEFAULT 'active',
  ADD CONSTRAINT ck_stored_files_lifecycle_status
    CHECK (lifecycle_status IN ('draft','active','deleted','purged')),
  ADD CONSTRAINT ck_stored_files_lifecycle_consistency CHECK (
    (lifecycle_status='draft' AND onboarding_draft_id IS NOT NULL
      AND draft_slot IS NOT NULL AND deleted_at IS NULL AND content_purged_at IS NULL)
    OR (lifecycle_status='active' AND deleted_at IS NULL AND content_purged_at IS NULL)
    OR (lifecycle_status='deleted' AND deleted_at IS NOT NULL AND content_purged_at IS NULL)
    OR (lifecycle_status='purged' AND deleted_at IS NOT NULL AND content_purged_at IS NOT NULL)
  );

DROP INDEX IF EXISTS uq_draft_current_document;
CREATE UNIQUE INDEX uq_stored_files_active_draft_slot
  ON stored_files(organization_id,onboarding_draft_id,draft_slot)
  WHERE lifecycle_status='draft';
CREATE INDEX ix_stored_files_lifecycle_cleanup
  ON stored_files(organization_id,lifecycle_status,deleted_at,id)
  WHERE lifecycle_status IN ('deleted','purged');

CREATE TABLE employment_contract_document_versions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id bigint NOT NULL,
  employment_contract_id bigint NOT NULL,
  file_id bigint NOT NULL,
  version_no integer NOT NULL CHECK (version_no>0),
  is_current boolean NOT NULL DEFAULT true,
  correction_reason text,
  created_by_user_id bigint REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_contract_document_version UNIQUE
    (organization_id,employment_contract_id,version_no),
  CONSTRAINT fk_contract_document_version_contract FOREIGN KEY
    (organization_id,employment_contract_id)
    REFERENCES employment_contracts(organization_id,id),
  CONSTRAINT fk_contract_document_version_file FOREIGN KEY
    (organization_id,file_id) REFERENCES stored_files(organization_id,id)
);
CREATE UNIQUE INDEX uq_contract_document_current
  ON employment_contract_document_versions(organization_id,employment_contract_id)
  WHERE is_current;

CREATE TABLE employee_assignment_document_versions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id bigint NOT NULL,
  employee_assignment_id bigint NOT NULL,
  file_id bigint NOT NULL,
  version_no integer NOT NULL CHECK (version_no>0),
  is_current boolean NOT NULL DEFAULT true,
  correction_reason text,
  created_by_user_id bigint REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_assignment_document_version UNIQUE
    (organization_id,employee_assignment_id,version_no),
  CONSTRAINT fk_assignment_document_version_assignment FOREIGN KEY
    (organization_id,employee_assignment_id)
    REFERENCES employee_assignments(organization_id,id),
  CONSTRAINT fk_assignment_document_version_file FOREIGN KEY
    (organization_id,file_id) REFERENCES stored_files(organization_id,id)
);
CREATE UNIQUE INDEX uq_assignment_document_current
  ON employee_assignment_document_versions(organization_id,employee_assignment_id)
  WHERE is_current;

INSERT INTO employment_contract_document_versions(
  organization_id,employment_contract_id,file_id,version_no,is_current)
SELECT organization_id,id,document_file_id,1,true
FROM employment_contracts WHERE document_file_id IS NOT NULL;

INSERT INTO employee_assignment_document_versions(
  organization_id,employee_assignment_id,file_id,version_no,is_current)
SELECT organization_id,id,document_file_id,1,true
FROM employee_assignments WHERE document_file_id IS NOT NULL;

ALTER TABLE file_cleanup_items
  DROP CONSTRAINT uq_file_cleanup_item,
  ALTER COLUMN stored_file_id DROP NOT NULL,
  ADD COLUMN object_key varchar(1000),
  ADD CONSTRAINT ck_file_cleanup_item_target CHECK (
    (stored_file_id IS NOT NULL AND object_key IS NULL)
    OR (stored_file_id IS NULL AND object_key IS NOT NULL)
  );
CREATE UNIQUE INDEX uq_file_cleanup_item_stored_file
  ON file_cleanup_items(run_id,stored_file_id) WHERE stored_file_id IS NOT NULL;
CREATE UNIQUE INDEX uq_file_cleanup_item_object_key
  ON file_cleanup_items(run_id,object_key) WHERE object_key IS NOT NULL;

COMMENT ON COLUMN file_cleanup_items.object_key IS
  'Path relatif untuk byte filesystem yang tidak memiliki metadata stored_files.';

COMMENT ON COLUMN stored_files.lifecycle_status IS
  'Lifecycle byte dan metadata: draft, active, deleted, atau purged.';
COMMENT ON COLUMN stored_files.draft_slot IS
  'Slot stabil file draft agar penggantian hanya menyisakan satu file aktif per tujuan.';
COMMENT ON TABLE employment_contract_document_versions IS
  'Versi dokumen kontrak resmi; koreksi tidak menghilangkan dokumen sebelumnya.';
COMMENT ON TABLE employee_assignment_document_versions IS
  'Versi dokumen penempatan resmi; koreksi tidak menghilangkan dokumen sebelumnya.';

DO $$
DECLARE draft_files bigint; active_files bigint; deleted_files bigint; purged_files bigint;
BEGIN
  SELECT count(*) FILTER (WHERE lifecycle_status='draft'),
    count(*) FILTER (WHERE lifecycle_status='active'),
    count(*) FILTER (WHERE lifecycle_status='deleted'),
    count(*) FILTER (WHERE lifecycle_status='purged')
  INTO draft_files,active_files,deleted_files,purged_files FROM stored_files;
  RAISE NOTICE 'File sesudah migration 031: draft=%, active=%, deleted=%, purged=%',
    draft_files,active_files,deleted_files,purged_files;
END $$;

COMMIT;



