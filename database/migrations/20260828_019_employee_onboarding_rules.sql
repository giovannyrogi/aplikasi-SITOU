BEGIN;

UPDATE employees
SET marital_status = CASE lower(trim(marital_status))
  WHEN 'belum menikah' THEN 'single'
  WHEN 'lajang' THEN 'single'
  WHEN 'menikah' THEN 'married'
  WHEN 'kawin' THEN 'married'
  WHEN 'cerai hidup' THEN 'divorced'
  WHEN 'cerai mati' THEN 'widowed'
  ELSE lower(trim(marital_status))
END
WHERE marital_status IS NOT NULL;

DO $$
DECLARE
  missing_nik_count bigint;
  invalid_marital_status_count bigint;
BEGIN
  SELECT count(*) INTO missing_nik_count
  FROM employees
  WHERE national_id IS NULL;

  IF missing_nik_count > 0 THEN
    RAISE EXCEPTION
      'Migration dihentikan: % pegawai belum memiliki NIK. Lengkapi NIK 16 digit sebelum menjalankan migration 019.',
      missing_nik_count;
  END IF;

  SELECT count(*) INTO invalid_marital_status_count
  FROM employees
  WHERE marital_status IS NOT NULL
    AND marital_status NOT IN ('single','married','divorced','widowed');

  IF invalid_marital_status_count > 0 THEN
    RAISE EXCEPTION
      'Migration dihentikan: % pegawai memiliki status perkawinan lama yang belum dipetakan.',
      invalid_marital_status_count;
  END IF;
END $$;

ALTER TABLE employees
  ALTER COLUMN national_id SET NOT NULL;

ALTER TABLE employees
  DROP CONSTRAINT IF EXISTS ck_employees_national_id;
ALTER TABLE employees
  ADD CONSTRAINT ck_employees_national_id
  CHECK (national_id ~ '^[0-9]{16}$');

ALTER TABLE employees
  DROP CONSTRAINT IF EXISTS ck_employees_marital_status;
ALTER TABLE employees
  ADD CONSTRAINT ck_employees_marital_status
  CHECK (marital_status IS NULL OR marital_status IN ('single','married','divorced','widowed'));

DO $$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'employee_onboarding_drafts'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%current_step%'
  LOOP
    EXECUTE format(
      'ALTER TABLE employee_onboarding_drafts DROP CONSTRAINT %I',
      constraint_name
    );
  END LOOP;
END $$;

ALTER TABLE employee_onboarding_drafts
  ADD CONSTRAINT ck_employee_onboarding_draft_current_step
  CHECK (current_step BETWEEN 0 AND 3);

COMMIT;
