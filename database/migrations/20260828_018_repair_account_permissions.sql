BEGIN;

-- Repair instalasi yang belum memiliki permission pengelolaan akun organisasi.
-- Cakupan migration sengaja dibatasi pada modul Akun Organisasi.
INSERT INTO permissions (code, description)
VALUES
  ('accounts.read', 'Melihat akun organisasi.'),
  ('accounts.manage', 'Membuat, menautkan, dan mengubah akun organisasi.')
ON CONFLICT (code) DO UPDATE
SET description = EXCLUDED.description;

INSERT INTO role_permissions (role_id, permission_id)
SELECT role_row.id, permission_row.id
FROM roles AS role_row
CROSS JOIN permissions AS permission_row
WHERE role_row.code IN ('superadmin', 'hrd')
  AND permission_row.code IN ('accounts.read', 'accounts.manage')
ON CONFLICT (role_id, permission_id) DO NOTHING;

DO $$
BEGIN
  IF (
    SELECT COUNT(*)
    FROM role_permissions AS role_permission
    JOIN roles AS role_row ON role_row.id = role_permission.role_id
    JOIN permissions AS permission_row ON permission_row.id = role_permission.permission_id
    WHERE role_row.code IN ('superadmin', 'hrd')
      AND permission_row.code IN ('accounts.read', 'accounts.manage')
  ) <> 4 THEN
    RAISE EXCEPTION 'Mapping permission Akun Organisasi untuk Superadmin dan HRD tidak lengkap';
  END IF;
END;
$$;

COMMIT;
