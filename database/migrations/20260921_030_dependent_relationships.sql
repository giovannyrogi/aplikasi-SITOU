BEGIN;

LOCK TABLE employee_dependents IN ACCESS EXCLUSIVE MODE;
LOCK TABLE employee_emergency_contacts IN SHARE MODE;
LOCK TABLE employees IN SHARE MODE;

CREATE TEMP TABLE dependent_spouse_resolution ON COMMIT DROP AS
WITH spouse AS (
  SELECT dependent.id,dependent.organization_id,dependent.employee_id,
    dependent.full_name,dependent.phone,employee.gender,
    count(*) OVER (
      PARTITION BY dependent.organization_id,dependent.employee_id
    )::int AS spouse_count
  FROM employee_dependents dependent
  JOIN employees employee
    ON employee.organization_id=dependent.organization_id
   AND employee.id=dependent.employee_id
  WHERE dependent.relationship='spouse'
), contacts AS (
  SELECT contact.organization_id,contact.employee_id,contact.full_name,contact.phone,
    CASE
      WHEN lower(trim(contact.relationship)) IN ('istri','isteri','istir') THEN 'wife'
      WHEN lower(trim(contact.relationship))='suami' THEN 'husband'
    END AS target_relationship
  FROM employee_emergency_contacts contact
  WHERE lower(trim(contact.relationship)) IN ('istri','isteri','istir','suami')
), direct_evidence AS (
  SELECT spouse.id,
    array_agg(DISTINCT contact.target_relationship)
      FILTER (WHERE contact.target_relationship IS NOT NULL) AS relationships
  FROM spouse
  LEFT JOIN contacts contact
    ON contact.organization_id=spouse.organization_id
   AND contact.employee_id=spouse.employee_id
   AND (
     lower(regexp_replace(contact.full_name,'[^[:alnum:]]','','g'))
       =lower(regexp_replace(spouse.full_name,'[^[:alnum:]]','','g'))
     OR
     (spouse.phone IS NOT NULL AND contact.phone=spouse.phone)
   )
  GROUP BY spouse.id
), employee_evidence AS (
  SELECT contact.organization_id,contact.employee_id,count(*)::int AS contact_count,
    array_agg(DISTINCT contact.target_relationship) AS relationships
  FROM contacts contact
  GROUP BY contact.organization_id,contact.employee_id
)
SELECT spouse.id AS dependent_id,
  CASE
    WHEN cardinality(direct.relationships)=1 THEN direct.relationships[1]
    WHEN COALESCE(cardinality(direct.relationships),0)=0
      AND spouse.spouse_count=1
      AND employee_evidence.contact_count=1
      AND cardinality(employee_evidence.relationships)=1
      THEN employee_evidence.relationships[1]
    WHEN spouse.gender='male' THEN 'wife'
    WHEN spouse.gender='female' THEN 'husband'
  END AS target_relationship,
  CASE
    WHEN cardinality(direct.relationships)=1 THEN 'matched_contact'
    WHEN COALESCE(cardinality(direct.relationships),0)=0
      AND spouse.spouse_count=1
      AND employee_evidence.contact_count=1
      AND cardinality(employee_evidence.relationships)=1
      THEN 'single_employee_contact'
    WHEN spouse.gender IN ('male','female') THEN 'employee_gender'
  END AS evidence_source,
  (
    COALESCE(cardinality(direct.relationships),0)>1
    OR (
      COALESCE(cardinality(direct.relationships),0)=0
      AND spouse.spouse_count=1
      AND COALESCE(cardinality(employee_evidence.relationships),0)>1
    )
  ) AS has_conflict
FROM spouse
LEFT JOIN direct_evidence direct ON direct.id=spouse.id
LEFT JOIN employee_evidence
  ON employee_evidence.organization_id=spouse.organization_id
 AND employee_evidence.employee_id=spouse.employee_id;

DO $$
DECLARE
  conflict_count integer;
  unresolved_count integer;
  invalid_parent_count integer;
  legacy_spouse_count integer;
  legacy_parent_count integer;
  record_data record;
BEGIN
  SELECT count(*) FILTER (WHERE relationship='spouse'),
         count(*) FILTER (WHERE relationship='parent')
  INTO legacy_spouse_count,legacy_parent_count
  FROM employee_dependents;

  RAISE NOTICE 'Jumlah hubungan lama sebelum konversi: spouse=%, parent=%',
    legacy_spouse_count,legacy_parent_count;

  SELECT count(*) INTO conflict_count
  FROM dependent_spouse_resolution
  WHERE has_conflict;

  IF conflict_count>0 THEN
    RAISE EXCEPTION
      'Migration dibatalkan: % data Pasangan memiliki bukti kontak Istri dan Suami yang bertentangan.',
      conflict_count;
  END IF;

  SELECT count(*) INTO unresolved_count
  FROM dependent_spouse_resolution
  WHERE target_relationship IS NULL;

  IF unresolved_count>0 THEN
    RAISE EXCEPTION
      'Migration dibatalkan: % data Pasangan tidak memiliki bukti kontak atau gender yang dapat dipetakan.',
      unresolved_count;
  END IF;

  SELECT count(*) INTO invalid_parent_count
  FROM employee_dependents
  WHERE relationship='parent'
    AND CASE
      WHEN national_id ~ '^[0-9]{16}$' THEN
        NOT (
          substring(national_id FROM 7 FOR 2)::int BETWEEN 1 AND 31
          OR substring(national_id FROM 7 FOR 2)::int BETWEEN 41 AND 71
        )
      ELSE true
    END;

  IF invalid_parent_count>0 THEN
    RAISE EXCEPTION
      'Migration dibatalkan: % data Orang tua memiliki NIK yang tidak dapat dipetakan menjadi Ayah atau Ibu.',
      invalid_parent_count;
  END IF;

  FOR record_data IN
    SELECT evidence_source,target_relationship,count(*)::int AS total
    FROM dependent_spouse_resolution
    GROUP BY evidence_source,target_relationship
    ORDER BY evidence_source,target_relationship
  LOOP
    RAISE NOTICE 'Konversi Pasangan: sumber=%, tujuan=%, jumlah=%',
      record_data.evidence_source,record_data.target_relationship,record_data.total;
  END LOOP;
END;
$$;

ALTER TABLE employee_dependents
  DROP CONSTRAINT IF EXISTS employee_dependents_relationship_check;

UPDATE employee_dependents dependent
SET relationship=resolution.target_relationship
FROM dependent_spouse_resolution resolution
WHERE dependent.id=resolution.dependent_id
  AND dependent.relationship='spouse';

UPDATE employee_dependents
SET relationship=CASE
  WHEN substring(national_id FROM 7 FOR 2)::int BETWEEN 1 AND 31 THEN 'father'
  WHEN substring(national_id FROM 7 FOR 2)::int BETWEEN 41 AND 71 THEN 'mother'
END
WHERE relationship='parent';

DO $$
DECLARE
  legacy_count integer;
  record_data record;
BEGIN
  SELECT count(*) INTO legacy_count
  FROM employee_dependents
  WHERE relationship IN ('spouse','parent');

  IF legacy_count>0 THEN
    RAISE EXCEPTION
      'Migration dibatalkan: masih terdapat % hubungan legacy spouse/parent.',
      legacy_count;
  END IF;

  FOR record_data IN
    SELECT relationship,count(*)::int AS total
    FROM employee_dependents
    GROUP BY relationship
    ORDER BY relationship
  LOOP
    RAISE NOTICE 'Jumlah hubungan akhir: %= %',record_data.relationship,record_data.total;
  END LOOP;
END;
$$;

ALTER TABLE employee_dependents
  ADD CONSTRAINT employee_dependents_relationship_check CHECK (
    relationship IN (
      'wife','husband','child','father','mother','sibling',
      'father_in_law','mother_in_law','grandfather','grandmother',
      'grandchild','guardian','other'
    )
  );

COMMENT ON COLUMN employee_dependents.relationship IS
  'Hubungan keluarga canonical: istri, suami, anak, ayah, ibu, saudara kandung, mertua, kakek, nenek, cucu, wali, atau lainnya.';
COMMENT ON TABLE employee_dependents IS
  'Anggota keluarga, tanggungan, dan kontak darurat terkait disimpan per individu.';

COMMIT;
