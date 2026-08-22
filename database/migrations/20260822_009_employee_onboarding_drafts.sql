BEGIN;

CREATE TABLE IF NOT EXISTS employee_onboarding_drafts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id bigint NOT NULL REFERENCES organizations(id),
  created_by_user_id bigint NOT NULL REFERENCES users(id),
  status varchar(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','finalizing','completed','discarded','expired')),
  current_step smallint NOT NULL DEFAULT 0 CHECK (current_step BETWEEN 0 AND 2),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload)='object'),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  submitted_employee_id bigint,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_employee_onboarding_drafts_org_id UNIQUE (organization_id,id),
  CONSTRAINT fk_employee_onboarding_draft_employee
    FOREIGN KEY (organization_id,submitted_employee_id) REFERENCES employees(organization_id,id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_active_employee_onboarding_draft
  ON employee_onboarding_drafts(organization_id,created_by_user_id)
  WHERE status IN ('active','finalizing');
CREATE INDEX IF NOT EXISTS ix_employee_onboarding_drafts_expiry
  ON employee_onboarding_drafts(status,expires_at)
  WHERE status='active';

DROP TRIGGER IF EXISTS trg_employee_onboarding_drafts_updated_at ON employee_onboarding_drafts;
CREATE TRIGGER trg_employee_onboarding_drafts_updated_at
BEFORE UPDATE ON employee_onboarding_drafts
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE stored_files
  ADD COLUMN IF NOT EXISTS onboarding_draft_id bigint;

DO $$
DECLARE constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid='stored_files'::regclass
    AND contype='c'
    AND pg_get_constraintdef(oid) ILIKE '%category%';
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE stored_files DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE stored_files
  ADD CONSTRAINT ck_stored_files_category CHECK (
    category IN ('logo','employee_photo','attendance_photo','medical_letter','contract',
      'assignment_decree','discipline_letter','identity','education','other')
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='fk_stored_file_onboarding_draft'
  ) THEN
    ALTER TABLE stored_files ADD CONSTRAINT fk_stored_file_onboarding_draft
      FOREIGN KEY (organization_id,onboarding_draft_id)
      REFERENCES employee_onboarding_drafts(organization_id,id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_stored_files_onboarding_draft
  ON stored_files(organization_id,onboarding_draft_id,category,created_at DESC)
  WHERE onboarding_draft_id IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_draft_current_document
  ON stored_files(onboarding_draft_id,category)
  WHERE onboarding_draft_id IS NOT NULL
    AND deleted_at IS NULL
    AND category IN ('contract','assignment_decree');

COMMIT;
