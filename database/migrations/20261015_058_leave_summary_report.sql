-- Menu laporan terpisah dari akses operasional Cuti & Izin; tidak menambah grant otomatis.
INSERT INTO hris_menu_definitions(code,label,group_label,route_path,can_manage)
VALUES ('leave-summary-report','Rekap Cuti & Izin','Laporan','/reports/leave-summary',false)
ON CONFLICT (code) DO UPDATE SET label=EXCLUDED.label,group_label=EXCLUDED.group_label,
route_path=EXCLUDED.route_path,can_manage=EXCLUDED.can_manage;
