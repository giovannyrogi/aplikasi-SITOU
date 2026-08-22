BEGIN;

-- Hentikan batch ZIP yang belum selesai sebelum kontrak import disederhanakan menjadi Excel saja.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='employee_import_batches'
      AND column_name='source_kind'
  ) THEN
    EXECUTE $sql$
      UPDATE employee_import_batches
      SET status='cancelled', error_summary=jsonb_build_object(
        'code','IMPORT_SOURCE_RETIRED',
        'message','Batch dibatalkan karena import dokumen ZIP tidak lagi didukung.'
      )
      WHERE source_kind='zip'
        AND status IN ('uploaded','validating','validated','committing','partially_committed')
    $sql$;
  END IF;
END $$;

-- Migration berhenti tanpa mengubah identitas bila normalisasi menemukan konflik data lama.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM employees
    GROUP BY organization_id,upper(btrim(employee_no)) HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Normalisasi Nomor Pegawai menemukan duplikasi. Perbaiki data sebelum migration.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM employees
    WHERE national_id IS NOT NULL
    GROUP BY organization_id,regexp_replace(national_id,'[^0-9]','','g') HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Normalisasi NIK menemukan duplikasi. Perbaiki data sebelum migration.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM employees
    WHERE national_id IS NOT NULL
      AND regexp_replace(national_id,'[^0-9]','','g') !~ '^[0-9]{16}$'
  ) THEN
    RAISE EXCEPTION 'Terdapat NIK yang bukan 16 digit. Perbaiki data sebelum migration.';
  END IF;
END $$;

UPDATE employees SET employee_no=upper(btrim(employee_no));
UPDATE employees
SET national_id=regexp_replace(national_id,'[^0-9]','','g')
WHERE national_id IS NOT NULL;

DROP INDEX IF EXISTS uq_employees_org_nik;
CREATE UNIQUE INDEX IF NOT EXISTS uq_employees_org_number_normalized
  ON employees(organization_id,upper(btrim(employee_no)));
CREATE UNIQUE INDEX IF NOT EXISTS uq_employees_org_nik
  ON employees(organization_id,national_id)
  WHERE national_id IS NOT NULL;

ALTER TABLE employees DROP CONSTRAINT IF EXISTS ck_employees_national_id;
ALTER TABLE employees ADD CONSTRAINT ck_employees_national_id
  CHECK (national_id IS NULL OR national_id ~ '^[0-9]{16}$');

ALTER TABLE employee_import_batches
  DROP CONSTRAINT IF EXISTS ck_employee_import_batches_source_kind,
  DROP CONSTRAINT IF EXISTS ck_employee_import_batches_counts,
  DROP COLUMN IF EXISTS source_kind,
  DROP COLUMN IF EXISTS total_documents;

ALTER TABLE employee_import_batches ADD CONSTRAINT ck_employee_import_batches_counts CHECK (
  total_employees >= 0 AND valid_employees >= 0 AND invalid_employees >= 0
  AND committed_employees >= 0
);

COMMIT;
