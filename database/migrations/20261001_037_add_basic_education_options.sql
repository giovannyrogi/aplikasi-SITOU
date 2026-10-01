BEGIN;

SELECT pg_advisory_xact_lock(hashtextextended('sitou:employee-education-options:037', 0));

ALTER TABLE employee_educations
  DROP CONSTRAINT IF EXISTS ck_employee_education_details,
  ADD CONSTRAINT ck_employee_education_details CHECK (
    (
      education_level IN ('Tidak/Belum Pernah Sekolah', 'Tidak/Belum Tamat SD')
      AND institution IS NULL
      AND field_of_study IS NULL
      AND graduation_year IS NULL
      AND certificate_file_id IS NULL
      AND is_highest
    )
    OR
    (
      education_level NOT IN ('Tidak/Belum Pernah Sekolah', 'Tidak/Belum Tamat SD')
      AND institution IS NOT NULL
      AND btrim(institution) <> ''
    )
  ) NOT VALID;

COMMENT ON CONSTRAINT ck_employee_education_details ON employee_educations IS
  'Pilihan Tidak/Belum Pernah Sekolah dan Tidak/Belum Tamat SD tidak memakai rincian sekolah atau ijazah; jenjang lain wajib memiliki institusi.';

COMMIT;
