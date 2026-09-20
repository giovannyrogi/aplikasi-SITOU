BEGIN;

CREATE TABLE disciplinary_action_types (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id bigint NOT NULL REFERENCES organizations(id),
  system_key varchar(30),
  name varchar(100) NOT NULL,
  duration_mode varchar(15) NOT NULL DEFAULT 'fixed'
    CHECK (duration_mode IN ('fixed','indefinite')),
  duration_value integer,
  duration_unit varchar(10),
  requires_document boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_by_user_id bigint REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_disciplinary_action_types_org_id UNIQUE (organization_id,id),
  CONSTRAINT ck_disciplinary_action_type_duration CHECK (
    (duration_mode='indefinite' AND duration_value IS NULL AND duration_unit IS NULL)
    OR
    (duration_mode='fixed' AND duration_value BETWEEN 1 AND 36500
      AND duration_unit IN ('day','month'))
  )
);

CREATE UNIQUE INDEX uq_disciplinary_action_type_system_key
  ON disciplinary_action_types(organization_id,system_key)
  WHERE system_key IS NOT NULL;
CREATE UNIQUE INDEX uq_disciplinary_action_type_name
  ON disciplinary_action_types(organization_id,lower(name));
CREATE INDEX ix_disciplinary_action_types_options
  ON disciplinary_action_types(organization_id,is_active,name,id);
CREATE TRIGGER trg_disciplinary_action_types_updated_at
BEFORE UPDATE ON disciplinary_action_types
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE disciplinary_action_types IS
  'Pilihan dan kebijakan tindakan disiplin per organisasi. Jenis yang pernah dipakai dinonaktifkan, bukan dihapus.';
COMMENT ON COLUMN disciplinary_action_types.system_key IS
  'Identitas internal jenis bawaan; tidak ditampilkan atau dapat diubah melalui UI.';

INSERT INTO disciplinary_action_types
  (organization_id,system_key,name,duration_mode,duration_value,duration_unit,
   requires_document,is_active)
SELECT organization.id,seed.system_key,seed.name,seed.duration_mode,seed.duration_value,
  seed.duration_unit,seed.requires_document,true
FROM organizations organization
CROSS JOIN (VALUES
  ('oral_warning','Teguran Lisan','fixed',3,'month',false),
  ('sp1','SP1','fixed',3,'month',true),
  ('sp2','SP2','fixed',3,'month',true),
  ('sp3','SP3','fixed',3,'month',true),
  ('suspension','Skorsing','fixed',1,'month',true),
  ('demotion','Demosi','indefinite',NULL::integer,NULL::varchar,true)
) AS seed(system_key,name,duration_mode,duration_value,duration_unit,requires_document);

-- Pertahankan jenis legacy di luar enam bawaan hanya untuk histori organisasi terkait.
INSERT INTO disciplinary_action_types
  (organization_id,system_key,name,duration_mode,duration_value,duration_unit,
   requires_document,is_active)
SELECT DISTINCT action.organization_id,action.action_type,
  CASE action.action_type
    WHEN 'salary_delay' THEN 'Penundaan Gaji'
    WHEN 'promotion_delay' THEN 'Penundaan Promosi'
    WHEN 'fine' THEN 'Denda'
    WHEN 'termination' THEN 'Pengakhiran Hubungan Kerja'
    ELSE 'Tindakan Lain'
  END,
  'indefinite',NULL::integer,NULL::varchar,true,false
FROM disciplinary_actions action
WHERE action.action_type NOT IN ('oral_warning','sp1','sp2','sp3','suspension','demotion')
ON CONFLICT DO NOTHING;

ALTER TABLE disciplinary_actions
  ADD COLUMN action_type_id bigint,
  ADD COLUMN action_name_snapshot varchar(100),
  ADD COLUMN duration_value_snapshot integer,
  ADD COLUMN duration_unit_snapshot varchar(10),
  ADD COLUMN requires_document_snapshot boolean;

UPDATE disciplinary_actions action
SET action_type_id=type.id,
    action_name_snapshot=type.name,
    duration_value_snapshot=CASE
      WHEN action.effective_until IS NULL THEN NULL
      WHEN action.action_type IN ('sp1','sp2','sp3') THEN 3
      ELSE GREATEST(1,action.effective_until-action.effective_from)
    END,
    duration_unit_snapshot=CASE
      WHEN action.effective_until IS NULL THEN NULL
      WHEN action.action_type IN ('sp1','sp2','sp3') THEN 'month'
      ELSE 'day'
    END,
    requires_document_snapshot=type.requires_document
FROM disciplinary_action_types type
WHERE type.organization_id=action.organization_id
  AND type.system_key=action.action_type;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM disciplinary_actions WHERE action_type_id IS NULL) THEN
    RAISE EXCEPTION 'Migration dibatalkan: terdapat tindakan lama yang tidak dapat dipetakan ke master sanksi.';
  END IF;
END;
$$;

ALTER TABLE disciplinary_actions
  ALTER COLUMN action_type_id SET NOT NULL,
  ALTER COLUMN action_name_snapshot SET NOT NULL,
  ALTER COLUMN requires_document_snapshot SET NOT NULL,
  ADD CONSTRAINT fk_disciplinary_action_type
    FOREIGN KEY (organization_id,action_type_id)
    REFERENCES disciplinary_action_types(organization_id,id);

ALTER TABLE disciplinary_actions
  DROP CONSTRAINT IF EXISTS disciplinary_actions_action_type_check,
  DROP CONSTRAINT IF EXISTS ck_action_letter,
  DROP CONSTRAINT IF EXISTS ck_sp_validity,
  DROP CONSTRAINT IF EXISTS disciplinary_actions_status_check;

ALTER TABLE disciplinary_actions
  ADD CONSTRAINT disciplinary_actions_status_check
    CHECK (status IN ('draft','active','expired','revoked','appealed','superseded')),
  ADD CONSTRAINT ck_action_letter CHECK (
    status='draft' OR NOT requires_document_snapshot
    OR (letter_no IS NOT NULL AND document_file_id IS NOT NULL)
  ),
  ADD CONSTRAINT ck_action_duration_snapshot CHECK (
    (duration_value_snapshot IS NULL AND duration_unit_snapshot IS NULL)
    OR
    (duration_value_snapshot BETWEEN 1 AND 36500
      AND duration_unit_snapshot IN ('day','month'))
  );

DROP INDEX IF EXISTS ix_actions_official_report;
CREATE INDEX ix_actions_official_report
  ON disciplinary_actions(organization_id,issued_date DESC,employee_id,id DESC)
  INCLUDE (discipline_case_id,action_type_id,action_name_snapshot,status,effective_from,effective_until)
  WHERE status<>'draft';

ALTER TABLE disciplinary_actions DROP COLUMN action_type;

INSERT INTO permissions(code,description) VALUES
  ('discipline_settings.read','Melihat pengaturan sanksi organisasi.'),
  ('discipline_settings.manage','Mengubah pengaturan sanksi organisasi.')
ON CONFLICT (code) DO UPDATE SET description=EXCLUDED.description;

INSERT INTO role_permissions(role_id,permission_id)
SELECT role.id,permission.id
FROM roles role CROSS JOIN permissions permission
WHERE role.code IN ('superadmin','hrd')
  AND permission.code IN ('discipline_settings.read','discipline_settings.manage')
ON CONFLICT DO NOTHING;

COMMIT;
