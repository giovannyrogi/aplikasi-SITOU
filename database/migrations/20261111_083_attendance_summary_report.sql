-- Hak laporan baca saja. Grant HRD terdelegasi diberikan melalui Akun & Akses.
INSERT INTO hris_menu_definitions(code,label,group_label,route_path,can_manage)
VALUES ('attendance-summary-report','Rekap Absensi','Laporan','/reports/attendance-summary',false)
ON CONFLICT (code) DO UPDATE SET label=EXCLUDED.label,group_label=EXCLUDED.group_label,
route_path=EXCLUDED.route_path,can_manage=EXCLUDED.can_manage;
