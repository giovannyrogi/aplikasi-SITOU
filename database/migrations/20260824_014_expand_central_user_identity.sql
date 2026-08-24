-- Expand: pisahkan kredensial akun dari identitas manusia tanpa langsung menghapus kolom lama.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS credential_version integer NOT NULL DEFAULT 1,
  ALTER COLUMN email DROP NOT NULL,
  ALTER COLUMN full_name DROP NOT NULL;

DO $$ BEGIN
  ALTER TABLE users ADD CONSTRAINT ck_users_credential_version CHECK (credential_version > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS platform_user_profiles (
  user_id bigint PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  full_name varchar(200) NOT NULL,
  email citext,
  whatsapp varchar(30),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_platform_profiles_whatsapp CHECK (
    whatsapp IS NULL OR whatsapp ~ '^\+628[1-9][0-9]{7,10}$'
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_platform_profiles_email
  ON platform_user_profiles(email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_platform_profiles_whatsapp
  ON platform_user_profiles(whatsapp) WHERE whatsapp IS NOT NULL;

INSERT INTO platform_user_profiles(user_id,full_name,email,whatsapp)
SELECT DISTINCT user_account.id,
  COALESCE(NULLIF(btrim(user_account.full_name),''),'Superadmin'),
  user_account.email,user_account.phone
FROM users user_account
JOIN user_organization_roles membership ON membership.user_id=user_account.id
JOIN roles role ON role.id=membership.role_id
WHERE role.code='superadmin' AND role.scope='platform'
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE VIEW v_user_identity AS
SELECT user_account.id AS user_id,user_account.username::text AS username,
  COALESCE(employee.full_name,platform_profile.full_name,'@' || user_account.username::text) AS display_name,
  CASE WHEN employee.id IS NOT NULL THEN 'employee'
    WHEN platform_profile.user_id IS NOT NULL THEN 'platform' ELSE 'username' END AS identity_source,
  COALESCE(contact.work_email,contact.personal_email,platform_profile.email)::text AS contact_email,
  COALESCE(contact.whatsapp,platform_profile.whatsapp) AS whatsapp,
  employee.id AS employee_id,employee.organization_id AS employee_organization_id,
  employee.preferred_name,contact.personal_email::text AS personal_email,
  contact.work_email::text AS work_email
FROM users user_account
LEFT JOIN employees employee ON employee.user_id=user_account.id AND employee.deleted_at IS NULL
LEFT JOIN employee_contacts contact
  ON contact.organization_id=employee.organization_id AND contact.employee_id=employee.id
LEFT JOIN platform_user_profiles platform_profile ON platform_profile.user_id=user_account.id;

INSERT INTO permissions(code,description) VALUES
  ('profile_self.read','Membaca profil akun sendiri.'),
  ('profile_self.update','Memperbarui kontak profil sendiri.')
ON CONFLICT (code) DO UPDATE SET description=excluded.description;
INSERT INTO role_permissions(role_id,permission_id)
SELECT role.id,permission.id FROM roles role CROSS JOIN permissions permission
WHERE role.code IN ('superadmin','hrd','leader','employee')
  AND permission.code IN ('profile_self.read','profile_self.update')
ON CONFLICT DO NOTHING;

COMMENT ON COLUMN users.credential_version IS
  'Versi kredensial pada session; dinaikkan untuk membatalkan seluruh session lama.';
COMMENT ON TABLE platform_user_profiles IS
  'Identitas platform khusus user platform yang tidak memiliki profil pegawai organisasi.';
COMMENT ON VIEW v_user_identity IS
  'Identitas terpusat: profil pegawai, profil platform, lalu username sebagai fallback.';
