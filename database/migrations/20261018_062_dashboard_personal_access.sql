-- Ringkasan pribadi untuk HRD dan Pimpinan yang profil pegawainya tertaut.
-- Hak ini selalu dibatasi pemilik profil di service, bukan izin administrasi HRIS.
INSERT INTO role_permissions(role_id, permission_id)
SELECT role.id, permission.id
FROM roles role CROSS JOIN permissions permission
WHERE role.code IN ('hrd', 'leader')
  AND permission.code IN (
    'employees.read_self',
    'assignments.read_self',
    'contracts.read_self',
    'leave_requests.read_self',
    'disciplinary_actions.read_self',
    'private_files.read_self'
  )
ON CONFLICT DO NOTHING;
