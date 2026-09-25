BEGIN;

SELECT pg_advisory_xact_lock(hashtextextended('sitou:dependent-emergency-contact-migration', 0));
LOCK TABLE employee_dependents IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE employee_emergency_contacts IN SHARE ROW EXCLUSIVE MODE;

CREATE TEMP TABLE _035_dependent_contact_source ON COMMIT DROP AS
SELECT
  dependent.id,
  dependent.organization_id,
  dependent.employee_id,
  dependent.relationship,
  dependent.full_name,
  dependent.phone,
  regexp_replace(lower(btrim(dependent.full_name)), '[^[:alnum:]]+', '', 'g') AS normalized_name,
  regexp_replace(dependent.phone, '[^0-9]+', '', 'g') AS normalized_phone
FROM employee_dependents dependent
WHERE dependent.phone IS NOT NULL
  AND btrim(dependent.phone) <> '';

CREATE TEMP TABLE _035_emergency_contact_source ON COMMIT DROP AS
SELECT
  contact.id,
  contact.organization_id,
  contact.employee_id,
  contact.full_name,
  contact.phone,
  regexp_replace(lower(btrim(contact.full_name)), '[^[:alnum:]]+', '', 'g') AS normalized_name,
  regexp_replace(contact.phone, '[^0-9]+', '', 'g') AS normalized_phone
FROM employee_emergency_contacts contact;

CREATE TEMP TABLE _035_existing_matches ON COMMIT DROP AS
SELECT
  dependent.id AS dependent_id,
  EXISTS (
    SELECT 1
    FROM _035_emergency_contact_source contact
    WHERE contact.organization_id = dependent.organization_id
      AND contact.employee_id = dependent.employee_id
      AND contact.normalized_name = dependent.normalized_name
      AND contact.normalized_phone = dependent.normalized_phone
  ) AS exact_match
FROM _035_dependent_contact_source dependent
WHERE EXISTS (
  SELECT 1
  FROM _035_emergency_contact_source contact
  WHERE contact.organization_id = dependent.organization_id
    AND contact.employee_id = dependent.employee_id
    AND (
      contact.normalized_name = dependent.normalized_name
      OR contact.normalized_phone = dependent.normalized_phone
    )
);

CREATE TEMP TABLE _035_new_candidates ON COMMIT DROP AS
SELECT dependent.*
FROM _035_dependent_contact_source dependent
WHERE NOT EXISTS (
  SELECT 1
  FROM _035_emergency_contact_source contact
  WHERE contact.organization_id = dependent.organization_id
    AND contact.employee_id = dependent.employee_id
    AND (
      contact.normalized_name = dependent.normalized_name
      OR contact.normalized_phone = dependent.normalized_phone
    )
);

CREATE TEMP TABLE _035_conflicts ON COMMIT DROP AS
SELECT
  'phone_multiple_names'::text AS conflict_type,
  organization_id,
  employee_id,
  normalized_phone AS normalized_value
FROM _035_new_candidates
GROUP BY organization_id, employee_id, normalized_phone
HAVING count(DISTINCT normalized_name) > 1
UNION ALL
SELECT
  'name_multiple_phones'::text,
  organization_id,
  employee_id,
  normalized_name
FROM _035_new_candidates
GROUP BY organization_id, employee_id, normalized_name
HAVING count(DISTINCT normalized_phone) > 1;

DO $$
DECLARE
  conflict_count integer;
  conflict_sample text;
BEGIN
  SELECT count(*) INTO conflict_count FROM _035_conflicts;
  IF conflict_count > 0 THEN
    SELECT string_agg(
      format('organisasi=%s pegawai=%s jenis=%s', organization_id, employee_id, conflict_type),
      '; '
    )
    INTO conflict_sample
    FROM (SELECT * FROM _035_conflicts ORDER BY organization_id, employee_id LIMIT 10) sample;

    RAISE EXCEPTION
      'Migrasi kontak keluarga dibatalkan: ditemukan % konflik nomor/nama. Perbaiki data terlebih dahulu. Contoh: %',
      conflict_count,
      conflict_sample;
  END IF;
END;
$$;

CREATE TEMP TABLE _035_created_contacts ON COMMIT DROP AS
WITH unique_candidates AS (
  SELECT DISTINCT ON (organization_id, employee_id, normalized_name, normalized_phone)
    organization_id,
    employee_id,
    relationship,
    full_name,
    phone,
    id
  FROM _035_new_candidates
  ORDER BY organization_id, employee_id, normalized_name, normalized_phone, id
), inserted AS (
  INSERT INTO employee_emergency_contacts(
    organization_id,
    employee_id,
    full_name,
    relationship,
    phone,
    address,
    is_primary
  )
  SELECT
    candidate.organization_id,
    candidate.employee_id,
    candidate.full_name,
    CASE candidate.relationship
      WHEN 'wife' THEN 'Istri'
      WHEN 'husband' THEN 'Suami'
      WHEN 'child' THEN 'Anak'
      WHEN 'father' THEN 'Ayah'
      WHEN 'mother' THEN 'Ibu'
      WHEN 'sibling' THEN 'Saudara kandung'
      WHEN 'father_in_law' THEN 'Ayah mertua'
      WHEN 'mother_in_law' THEN 'Ibu mertua'
      WHEN 'grandfather' THEN 'Kakek'
      WHEN 'grandmother' THEN 'Nenek'
      WHEN 'grandchild' THEN 'Cucu'
      WHEN 'guardian' THEN 'Wali'
      ELSE 'Lainnya'
    END,
    candidate.phone,
    NULL,
    false
  FROM unique_candidates candidate
  WHERE NOT EXISTS (
    SELECT 1
    FROM employee_emergency_contacts contact
    WHERE contact.organization_id = candidate.organization_id
      AND contact.employee_id = candidate.employee_id
      AND (
        regexp_replace(lower(btrim(contact.full_name)), '[^[:alnum:]]+', '', 'g') =
          regexp_replace(lower(btrim(candidate.full_name)), '[^[:alnum:]]+', '', 'g')
        OR regexp_replace(contact.phone, '[^0-9]+', '', 'g') =
          regexp_replace(candidate.phone, '[^0-9]+', '', 'g')
      )
  )
  RETURNING id, organization_id, employee_id
)
SELECT * FROM inserted;

CREATE TEMP TABLE _035_primary_assignments ON COMMIT DROP AS
WITH eligible AS (
  SELECT organization_id, employee_id
  FROM employee_emergency_contacts
  GROUP BY organization_id, employee_id
  HAVING count(*) = 1
    AND count(*) FILTER (WHERE is_primary) = 0
), updated AS (
  UPDATE employee_emergency_contacts contact
  SET is_primary = true
  FROM eligible
  WHERE contact.organization_id = eligible.organization_id
    AND contact.employee_id = eligible.employee_id
  RETURNING contact.id, contact.organization_id, contact.employee_id
)
SELECT * FROM updated;

DO $$
DECLARE
  source_count integer;
  matched_count integer;
  ignored_count integer;
  created_count integer;
  primary_count integer;
  conflict_count integer;
BEGIN
  SELECT count(*) INTO source_count FROM _035_dependent_contact_source;
  SELECT count(*) INTO matched_count FROM _035_existing_matches;
  SELECT count(*) INTO ignored_count FROM _035_existing_matches WHERE NOT exact_match;
  SELECT count(*) INTO created_count FROM _035_created_contacts;
  SELECT count(*) INTO primary_count FROM _035_primary_assignments;
  SELECT count(*) INTO conflict_count FROM _035_conflicts;

  RAISE NOTICE
    'dependent contact migration 035: source=%, matched=%, created=%, ignored_by_emergency_contact=%, primary_assigned=%, conflict=%',
    source_count,
    matched_count,
    created_count,
    ignored_count,
    primary_count,
    conflict_count;
END;
$$;

ALTER TABLE employee_dependents
  DROP CONSTRAINT IF EXISTS ck_employee_dependents_phone_e164;

ALTER TABLE employee_dependents
  DROP COLUMN phone,
  DROP COLUMN is_emergency_contact;

COMMENT ON TABLE employee_dependents IS
  'Anggota keluarga dan tanggungan pegawai; data komunikasi dikelola melalui employee_emergency_contacts.';

COMMIT;

