-- Contract dijalankan setelah aplikasi memakai v_user_identity.
-- Arsip ini hanya untuk pemulihan migration dan bukan sumber identitas aplikasi.
CREATE TABLE IF NOT EXISTS user_identity_legacy_backups (
  user_id bigint PRIMARY KEY,
  username citext NOT NULL,
  full_name varchar(200),
  email citext,
  phone varchar(30),
  backed_up_at timestamptz NOT NULL DEFAULT now(),
  backup_reason text NOT NULL DEFAULT 'contract_user_identity_20260824'
);
COMMENT ON TABLE user_identity_legacy_backups IS
  'Arsip terbatas identitas users sebelum contract; bukan sumber identitas aplikasi dan harus mengikuti retention data pribadi.';

INSERT INTO user_identity_legacy_backups(user_id,username,full_name,email,phone)
SELECT id,username,full_name,email,phone
FROM users
WHERE full_name IS NOT NULL OR email IS NOT NULL OR phone IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM users user_account
    LEFT JOIN user_identity_legacy_backups backup ON backup.user_id=user_account.id
    WHERE (user_account.email IS NOT NULL OR user_account.full_name IS NOT NULL OR user_account.phone IS NOT NULL)
      AND backup.user_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Contract dibatalkan: backup identitas legacy belum lengkap.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM users user_account
    JOIN user_organization_roles membership ON membership.user_id=user_account.id
    JOIN roles role ON role.id=membership.role_id
    LEFT JOIN platform_user_profiles profile ON profile.user_id=user_account.id
    WHERE role.scope='platform' AND profile.user_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Contract dibatalkan: profil platform belum lengkap.';
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_platform_user_profiles_updated_at ON platform_user_profiles;
CREATE TRIGGER trg_platform_user_profiles_updated_at
BEFORE UPDATE ON platform_user_profiles
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;
DROP INDEX IF EXISTS users_email_key;
ALTER TABLE users
  DROP CONSTRAINT IF EXISTS ck_users_phone_e164,
  DROP COLUMN email,
  DROP COLUMN full_name,
  DROP COLUMN phone,
  DROP COLUMN email_verified_at;