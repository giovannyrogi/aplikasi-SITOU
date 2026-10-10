-- Konfigurasi eksplisit HRD; organisasi lama tetap legacy sampai Superadmin menetapkan admin.
CREATE TABLE organization_hris_access_policies (
 organization_id bigint PRIMARY KEY REFERENCES organizations(id),
 enabled boolean NOT NULL DEFAULT false, primary_membership_id bigint,
 version integer NOT NULL DEFAULT 1, updated_at timestamptz NOT NULL DEFAULT now(),
 updated_by_user_id bigint REFERENCES users(id),
 CHECK(NOT enabled OR primary_membership_id IS NOT NULL),
 FOREIGN KEY(organization_id,primary_membership_id) REFERENCES user_organization_roles(organization_id,id)
);
CREATE TABLE hris_menu_definitions (
 code varchar(80) PRIMARY KEY, label varchar(120) NOT NULL, group_label varchar(80) NOT NULL,
 route_path varchar(160) NOT NULL UNIQUE, can_manage boolean NOT NULL
);
INSERT INTO hris_menu_definitions(code,label,group_label,route_path,can_manage) VALUES
 ('dashboard','Dashboard','Dashboard','/dashboard',false),
 ('master-locations','Lokasi','Data Master','/master-data/locations',true),
 ('master-organization-unit-types','Jenis Unit Organisasi','Data Master','/master-data/organization-unit-types',true),
 ('master-organization-units','Divisi & Unit','Data Master','/master-data/organization-units',true),
 ('master-positions','Jabatan','Data Master','/master-data/positions',true),
 ('master-employment-types','Jenis Kepegawaian','Data Master','/master-data/employment-types',true),
 ('employees','Data Pegawai','Kepegawaian','/employees',true),
 ('leave-requests','Cuti & Izin','Kepegawaian','/leave-requests',true),
 ('expiring-contracts-report','Kontrak Akan Berakhir','Laporan','/reports/expiring-contracts',false),
 ('retirement-report','Proyeksi Pensiun','Laporan','/reports/retirements',false),
 ('disciplinary-actions-report','Sanksi Pegawai','Laporan','/reports/disciplinary-actions',false),
 ('leave-settings','Aturan Cuti & Izin','Pengaturan Organisasi','/organization-settings/leave-types',true),
 ('disciplinary-action-settings','Pengaturan Sanksi','Pengaturan Organisasi','/organization-settings/disciplinary-actions',true),
 ('retirement-policy','Kebijakan Pensiun','Pengaturan Organisasi','/organization-settings/retirement',true);
CREATE TABLE user_hris_menu_grants (
 organization_id bigint NOT NULL REFERENCES organizations(id), membership_id bigint NOT NULL,
 menu_code varchar(80) NOT NULL REFERENCES hris_menu_definitions(code),
 access_level varchar(10) NOT NULL CHECK(access_level IN ('read','manage')),
 PRIMARY KEY(organization_id,membership_id,menu_code),
 FOREIGN KEY(organization_id,membership_id) REFERENCES user_organization_roles(organization_id,id)
);
CREATE TABLE user_hris_access_settings (
 organization_id bigint NOT NULL REFERENCES organizations(id), membership_id bigint NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now(), updated_by_user_id bigint REFERENCES users(id),
 PRIMARY KEY(organization_id,membership_id),
 FOREIGN KEY(organization_id,membership_id) REFERENCES user_organization_roles(organization_id,id)
);
