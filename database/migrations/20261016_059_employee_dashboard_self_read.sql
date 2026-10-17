-- Ringkasan pribadi saja. Tidak memberi akses administrasi, dokumen atau persetujuan.
INSERT INTO permissions(code,description) VALUES
 ('leave_requests.read_self','Melihat cuti, izin dan saldo milik akun sendiri.'),
 ('disciplinary_actions.read_self','Melihat ringkasan tindakan disiplin resmi milik akun sendiri.')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions(role_id,permission_id)
SELECT role.id,permission.id FROM roles role CROSS JOIN permissions permission
WHERE role.code='employee' AND permission.code IN ('leave_requests.read_self','disciplinary_actions.read_self')
ON CONFLICT DO NOTHING;
