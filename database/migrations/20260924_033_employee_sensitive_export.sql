BEGIN;

INSERT INTO permissions(code,description)
VALUES ('employees.export_sensitive','Mengekspor profil administratif sensitif pegawai ke Excel.')
ON CONFLICT (code) DO UPDATE SET description=EXCLUDED.description;

INSERT INTO role_permissions(role_id,permission_id)
SELECT role.id,permission.id
FROM roles role CROSS JOIN permissions permission
WHERE role.code IN ('superadmin','hrd')
  AND permission.code='employees.export_sensitive'
ON CONFLICT DO NOTHING;

DELETE FROM role_permissions mapping
USING roles role,permissions permission
WHERE mapping.role_id=role.id AND mapping.permission_id=permission.id
  AND permission.code='employees.export_sensitive'
  AND role.code NOT IN ('superadmin','hrd');

DO $$
DECLARE
  allowed_roles text[];
BEGIN
  SELECT array_agg(role.code::text ORDER BY role.code)
  INTO allowed_roles
  FROM role_permissions mapping
  JOIN roles role ON role.id=mapping.role_id
  JOIN permissions permission ON permission.id=mapping.permission_id
  WHERE permission.code='employees.export_sensitive';

  IF allowed_roles IS DISTINCT FROM ARRAY['hrd','superadmin']::text[] THEN
    RAISE EXCEPTION 'Permission employees.export_sensitive tidak sesuai: %',allowed_roles;
  END IF;
END;
$$;

COMMIT;