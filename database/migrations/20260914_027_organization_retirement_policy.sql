BEGIN;

CREATE TABLE organization_retirement_policies (
  organization_id bigint PRIMARY KEY REFERENCES organizations(id),
  retirement_age smallint NOT NULL CHECK (retirement_age BETWEEN 18 AND 100),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by_user_id bigint REFERENCES users(id),
  change_reason text NOT NULL CHECK (length(trim(change_reason)) BETWEEN 5 AND 1000)
);

-- Pertahankan hasil proyeksi organisasi lama; organisasi baru wajib mengatur kebijakannya.
INSERT INTO organization_retirement_policies(organization_id, retirement_age, change_reason)
SELECT id, 58, 'Kebijakan awal dari perhitungan SITOU sebelum pengaturan per organisasi.'
FROM organizations;

INSERT INTO permissions(code, description) VALUES
('retirement_policy.read', 'Melihat kebijakan pensiun organisasi.'),
('retirement_policy.manage', 'Mengatur usia pensiun organisasi dengan alasan dan audit.')
ON CONFLICT (code) DO NOTHING;
INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE (r.code IN ('superadmin','hrd','leader') AND p.code='retirement_policy.read')
   OR (r.code IN ('superadmin','hrd') AND p.code='retirement_policy.manage')
ON CONFLICT DO NOTHING;

COMMIT;
