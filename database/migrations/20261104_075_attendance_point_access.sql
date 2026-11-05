ALTER TABLE attendance_point_assignments ADD COLUMN revoked_at timestamptz;
INSERT INTO hris_menu_definitions(code,label,group_label,route_path,can_manage)
VALUES ('attendance-point-access','Akses Titik Absensi','Pengaturan Organisasi','/organization-settings/attendance-point-access',true)
ON CONFLICT (code) DO NOTHING;
