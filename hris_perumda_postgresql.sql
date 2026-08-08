BEGIN;

CREATE EXTENSION IF NOT EXISTS citext;

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- TENANT / PERUSAHAAN
CREATE TABLE organizations (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, parent_id bigint REFERENCES organizations(id),
 code varchar(30) NOT NULL UNIQUE, name varchar(200) NOT NULL, legal_name varchar(250),
 organization_type varchar(30) NOT NULL DEFAULT 'company' CHECK (organization_type IN ('holding','company','agency')),
 timezone varchar(50) NOT NULL DEFAULT 'Asia/Makassar', locale varchar(10) NOT NULL DEFAULT 'id-ID',
 active_from date NOT NULL DEFAULT current_date, active_until date,
 is_active boolean NOT NULL DEFAULT true, settings jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (active_until IS NULL OR active_until >= active_from)
);
COMMENT ON TABLE organizations IS 'Tenant/perusahaan yang datanya terisolasi; dibuat dan diaktifkan oleh superadmin.';

CREATE TABLE subscription_plans (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code varchar(30) NOT NULL UNIQUE, name varchar(120) NOT NULL, billing_period varchar(20) NOT NULL CHECK (billing_period IN ('monthly','yearly','custom')),
 price numeric(18,2) NOT NULL DEFAULT 0 CHECK (price >= 0), max_locations integer, max_employees integer,
 features jsonb NOT NULL DEFAULT '{}'::jsonb, is_active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE subscription_plans IS 'Paket komersial aplikasi beserta batas lokasi, pegawai, dan fitur.';

CREATE TABLE organization_subscriptions (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, organization_id bigint NOT NULL REFERENCES organizations(id),
 subscription_plan_id bigint NOT NULL REFERENCES subscription_plans(id), starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL,
 grace_ends_at timestamptz, status varchar(20) NOT NULL CHECK (status IN ('trial','active','grace','expired','suspended','cancelled')),
 external_reference varchar(100), notes text, created_by bigint,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (ends_at > starts_at), CHECK (grace_ends_at IS NULL OR grace_ends_at >= ends_at)
);
COMMENT ON TABLE organization_subscriptions IS 'Masa langganan perusahaan; histori perpanjangan tidak ditimpa.';

CREATE TABLE locations (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, organization_id bigint NOT NULL REFERENCES organizations(id),
 parent_id bigint REFERENCES locations(id), code varchar(30) NOT NULL, name varchar(200) NOT NULL,
 location_type varchar(30) NOT NULL DEFAULT 'branch' CHECK (location_type IN ('head_office','branch','market','site','other')),
 address text, latitude numeric(10,7), longitude numeric(10,7), attendance_radius_m integer,
 active_from date NOT NULL DEFAULT current_date, active_until date, is_active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (organization_id, code), CHECK (active_until IS NULL OR active_until >= active_from),
 CHECK (attendance_radius_m IS NULL OR attendance_radius_m > 0)
);
COMMENT ON TABLE locations IS 'Kantor pusat, cabang, unit pasar, dan lokasi kerja/absensi.';

CREATE TABLE location_licenses (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, location_id bigint NOT NULL REFERENCES locations(id),
 organization_subscription_id bigint NOT NULL REFERENCES organization_subscriptions(id),
 active_from timestamptz NOT NULL, active_until timestamptz NOT NULL,
 status varchar(20) NOT NULL CHECK (status IN ('active','expired','suspended','revoked')),
 created_by bigint, created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (active_until > active_from)
);
COMMENT ON TABLE location_licenses IS 'Aktivasi komersial per lokasi yang diatur superadmin.';
CREATE INDEX ix_location_license_active ON location_licenses(location_id,active_until DESC);

CREATE TABLE org_units (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, organization_id bigint NOT NULL REFERENCES organizations(id),
 parent_id bigint REFERENCES org_units(id), code varchar(30) NOT NULL, name varchar(200) NOT NULL,
 unit_type varchar(30) NOT NULL DEFAULT 'division' CHECK (unit_type IN ('directorate','division','department','subdivision','unit','team','board','other')),
 active_from date NOT NULL DEFAULT current_date, active_until date, is_active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (organization_id, code), CHECK (active_until IS NULL OR active_until >= active_from)
);
COMMENT ON TABLE org_units IS 'Struktur organisasi bertingkat: direksi, bidang/divisi, sub-divisi, unit, dan tim.';

CREATE TABLE positions (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, organization_id bigint NOT NULL REFERENCES organizations(id),
 org_unit_id bigint REFERENCES org_units(id), code varchar(30) NOT NULL, name varchar(200) NOT NULL,
 grade varchar(50), level_no smallint, is_managerial boolean NOT NULL DEFAULT false,
 reports_to_position_id bigint REFERENCES positions(id), is_active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (organization_id, code)
);
COMMENT ON TABLE positions IS 'Master jabatan; terpisah dari pegawai agar perpindahan jabatan dapat diberi histori.';

-- AKUN DAN RBAC
CREATE TABLE users (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, email citext NOT NULL UNIQUE, password_hash text,
 full_name varchar(200) NOT NULL, phone varchar(30), is_active boolean NOT NULL DEFAULT true,
 email_verified_at timestamptz, last_login_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE users IS 'Identitas login global; password_hash dapat kosong bila memakai SSO.';
ALTER TABLE organization_subscriptions ADD CONSTRAINT fk_subscription_creator FOREIGN KEY (created_by) REFERENCES users(id);
ALTER TABLE location_licenses ADD CONSTRAINT fk_location_license_creator FOREIGN KEY (created_by) REFERENCES users(id);

CREATE TABLE roles (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, code varchar(40) NOT NULL UNIQUE, name varchar(100) NOT NULL,
 scope varchar(20) NOT NULL CHECK (scope IN ('platform','organization','self')), description text, is_system boolean NOT NULL DEFAULT false
);
CREATE TABLE permissions (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, code varchar(100) NOT NULL UNIQUE, description text
);
CREATE TABLE role_permissions (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 role_id bigint NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
 permission_id bigint NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
 UNIQUE (role_id, permission_id)
);
CREATE TABLE user_organization_roles (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 organization_id bigint REFERENCES organizations(id) ON DELETE CASCADE, role_id bigint NOT NULL REFERENCES roles(id),
 active_from timestamptz NOT NULL DEFAULT now(), active_until timestamptz,
 created_by bigint REFERENCES users(id),
 CHECK (active_until IS NULL OR active_until > active_from)
);
COMMENT ON TABLE user_organization_roles IS 'Penugasan role per tenant; organization_id NULL hanya untuk role platform/superadmin.';
CREATE UNIQUE INDEX uq_user_org_role ON user_organization_roles(user_id,organization_id,role_id) WHERE organization_id IS NOT NULL;
CREATE UNIQUE INDEX uq_user_platform_role ON user_organization_roles(user_id,role_id) WHERE organization_id IS NULL;

-- DATA INDUK PEGAWAI
CREATE TABLE employees (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, organization_id bigint NOT NULL REFERENCES organizations(id),
 employee_no varchar(60) NOT NULL, user_id bigint UNIQUE REFERENCES users(id),
 full_name varchar(200) NOT NULL, preferred_name varchar(100), national_id varchar(30),
 birth_place varchar(120), birth_date date, gender varchar(20) CHECK (gender IN ('male','female','other','undisclosed')),
 religion varchar(50), marital_status varchar(30), blood_type varchar(3), nationality varchar(60) DEFAULT 'Indonesia',
 employment_status varchar(30) NOT NULL DEFAULT 'active' CHECK (employment_status IN ('draft','active','probation','leave','suspended','terminated','retired','deceased')),
 joined_date date, termination_date date, termination_reason text, photo_path text,
 source_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz,
 UNIQUE (organization_id, employee_no),
 CHECK (termination_date IS NULL OR joined_date IS NULL OR termination_date >= joined_date)
);
COMMENT ON TABLE employees IS 'Profil inti pegawai. Umur dan masa kerja dihitung, bukan disimpan.';
COMMENT ON COLUMN employees.employee_no IS 'NIP/nomor induk internal dari Excel.';
COMMENT ON COLUMN employees.national_id IS 'NIK; disimpan sebagai teks agar nol awal tidak hilang.';
CREATE UNIQUE INDEX uq_employee_national_id ON employees(organization_id,national_id) WHERE national_id IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE employee_contacts (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 employee_id bigint NOT NULL UNIQUE REFERENCES employees(id) ON DELETE CASCADE,
 personal_email citext, work_email citext, phone varchar(30), whatsapp varchar(30),
 address text, village varchar(100), district varchar(100), city varchar(100), province varchar(100), postal_code varchar(10),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE employee_social_accounts (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, employee_id bigint NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
 platform varchar(50) NOT NULL, handle_or_url text NOT NULL, UNIQUE(employee_id, platform, handle_or_url)
);
CREATE TABLE employee_dependents (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, employee_id bigint NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
 relationship varchar(30) NOT NULL CHECK (relationship IN ('spouse','child','parent','other')),
 full_name varchar(200), birth_date date, gender varchar(20), national_id varchar(30), is_dependent boolean NOT NULL DEFAULT true,
 bpjs_number varchar(50), notes text
);
COMMENT ON TABLE employee_dependents IS 'Pasangan/anak disimpan per orang; jumlah pasangan dan anak diperoleh dengan COUNT.';

CREATE TABLE education_levels (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, code varchar(20) NOT NULL UNIQUE, name varchar(100) NOT NULL, rank_no smallint NOT NULL
);
CREATE TABLE employee_educations (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, employee_id bigint NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
 education_level_id bigint REFERENCES education_levels(id), institution varchar(200), field_of_study varchar(150),
 start_year smallint, graduation_year smallint, certificate_document_id bigint, is_highest boolean NOT NULL DEFAULT false,
 CHECK (graduation_year IS NULL OR start_year IS NULL OR graduation_year >= start_year)
);

CREATE TABLE employee_emergency_contacts (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, employee_id bigint NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
 full_name varchar(200) NOT NULL, relationship varchar(50), phone varchar(30) NOT NULL, address text, is_primary boolean NOT NULL DEFAULT false
);

CREATE TABLE employee_identifiers (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, employee_id bigint NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
 identifier_type varchar(40) NOT NULL CHECK (identifier_type IN ('bpjs_health','bpjs_employment','tax_npwp','passport','other')),
 identifier_value varchar(100) NOT NULL, issued_at date, expires_at date,
 UNIQUE(employee_id, identifier_type, identifier_value)
);
COMMENT ON TABLE employee_identifiers IS 'Nomor BPJS Kesehatan, BPJS Ketenagakerjaan/BSU, NPWP, dan identitas tambahan.';

CREATE TABLE employee_documents (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, employee_id bigint NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
 document_type varchar(50) NOT NULL, file_key text NOT NULL, original_name text NOT NULL,
 mime_type varchar(100), file_size bigint, issued_at date, expires_at date, verified_at timestamptz,
 verified_by bigint REFERENCES users(id), is_confidential boolean NOT NULL DEFAULT true,
 uploaded_by bigint REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (file_key !~ '(^/|\\.\\.)')
);
COMMENT ON COLUMN employee_documents.file_key IS 'Path relatif di bawah uploads/, bukan URL publik dan bukan path absolut.';
ALTER TABLE employee_educations ADD CONSTRAINT fk_education_certificate FOREIGN KEY (certificate_document_id) REFERENCES employee_documents(id);

-- HUBUNGAN KERJA, PENEMPATAN, JABATAN, DAN RIWAYAT
CREATE TABLE employment_types (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, code varchar(30) NOT NULL UNIQUE, name varchar(100) NOT NULL,
 requires_contract_end boolean NOT NULL DEFAULT false
);
CREATE TABLE employment_contracts (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, employee_id bigint NOT NULL REFERENCES employees(id),
 employment_type_id bigint NOT NULL REFERENCES employment_types(id), contract_no varchar(100),
 start_date date NOT NULL, end_date date, status varchar(20) NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','expired','terminated','renewed')),
 document_id bigint REFERENCES employee_documents(id), notes text,
 created_at timestamptz NOT NULL DEFAULT now(), CHECK (end_date IS NULL OR end_date >= start_date)
);
COMMENT ON TABLE employment_contracts IS 'Riwayat PKWTT/PKWT/PHL/THL/tenaga teknis/staf khusus; kontrak lama tidak ditimpa.';

CREATE TABLE employee_assignments (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, employee_id bigint NOT NULL REFERENCES employees(id),
 position_id bigint REFERENCES positions(id), org_unit_id bigint REFERENCES org_units(id), location_id bigint REFERENCES locations(id),
 assignment_type varchar(25) NOT NULL DEFAULT 'primary' CHECK (assignment_type IN ('primary','acting','temporary','additional')),
 start_date date NOT NULL, end_date date, change_reason varchar(50), decree_no varchar(100), document_id bigint REFERENCES employee_documents(id),
 supervisor_employee_id bigint REFERENCES employees(id), notes text,
 created_by bigint REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (end_date IS NULL OR end_date >= start_date)
);
COMMENT ON TABLE employee_assignments IS 'Sumber histori jabatan dan penempatan/mutasi. Satu baris per periode.';
CREATE UNIQUE INDEX uq_current_primary_assignment ON employee_assignments(employee_id) WHERE end_date IS NULL AND assignment_type='primary';
CREATE INDEX ix_assignments_employee_dates ON employee_assignments(employee_id,start_date DESC);

CREATE TABLE disciplinary_action_types (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, code varchar(20) NOT NULL UNIQUE, name varchar(100) NOT NULL,
 severity smallint NOT NULL CHECK (severity BETWEEN 1 AND 10), default_valid_months smallint
);
CREATE TABLE disciplinary_actions (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, employee_id bigint NOT NULL REFERENCES employees(id),
 action_type_id bigint NOT NULL REFERENCES disciplinary_action_types(id), case_no varchar(100),
 issued_date date NOT NULL, effective_from date NOT NULL, effective_until date, reason text NOT NULL,
 status varchar(20) NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','expired','revoked','appealed')),
 document_id bigint REFERENCES employee_documents(id), issued_by bigint REFERENCES users(id), revoked_at timestamptz, revocation_reason text,
 created_at timestamptz NOT NULL DEFAULT now(), CHECK (effective_until IS NULL OR effective_until >= effective_from)
);
COMMENT ON TABLE disciplinary_actions IS 'Riwayat SP1, SP2, SP3 dan tindakan disiplin lain tanpa menimpa histori.';

-- JADWAL DAN ABSENSI (SIAP WEB/MOBILE/DEVICE)
CREATE TABLE work_shifts (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, organization_id bigint NOT NULL REFERENCES organizations(id),
 code varchar(30) NOT NULL, name varchar(100) NOT NULL, start_time time NOT NULL, end_time time NOT NULL,
 break_minutes integer NOT NULL DEFAULT 0, crosses_midnight boolean NOT NULL DEFAULT false,
 late_tolerance_minutes integer NOT NULL DEFAULT 0, early_leave_tolerance_minutes integer NOT NULL DEFAULT 0,
 is_active boolean NOT NULL DEFAULT true, UNIQUE(organization_id,code)
);
CREATE TABLE employee_shift_schedules (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, employee_id bigint NOT NULL REFERENCES employees(id),
 shift_id bigint NOT NULL REFERENCES work_shifts(id), work_date date NOT NULL, location_id bigint REFERENCES locations(id),
 status varchar(20) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','off','holiday','cancelled')),
 created_by bigint REFERENCES users(id), UNIQUE(employee_id,work_date)
);
CREATE TABLE attendance_devices (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, organization_id bigint NOT NULL REFERENCES organizations(id),
 location_id bigint REFERENCES locations(id), device_code varchar(80) NOT NULL, name varchar(150),
 device_type varchar(30) NOT NULL CHECK (device_type IN ('mobile','web','fingerprint','face','import','api')),
 api_key_hash text, is_active boolean NOT NULL DEFAULT true, last_seen_at timestamptz,
 UNIQUE(organization_id,device_code)
);
CREATE TABLE attendance_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, organization_id bigint NOT NULL REFERENCES organizations(id),
 employee_id bigint NOT NULL REFERENCES employees(id), device_id bigint REFERENCES attendance_devices(id),
 event_type varchar(20) NOT NULL CHECK (event_type IN ('check_in','check_out','break_start','break_end')),
 occurred_at timestamptz NOT NULL, source varchar(20) NOT NULL CHECK (source IN ('mobile','web','device','import','api','manual')),
 latitude numeric(10,7), longitude numeric(10,7), accuracy_m numeric(8,2), photo_key text,
 client_event_id varchar(80), received_at timestamptz NOT NULL DEFAULT now(), metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_by bigint REFERENCES users(id)
);
COMMENT ON COLUMN attendance_events.client_event_id IS 'Kunci idempotensi dari aplikasi mobile agar sinkronisasi ulang tidak menggandakan absensi.';
CREATE INDEX ix_attendance_events_employee_time ON attendance_events(employee_id,occurred_at DESC);
CREATE UNIQUE INDEX uq_attendance_client_event ON attendance_events(organization_id,client_event_id) WHERE client_event_id IS NOT NULL;

CREATE TABLE attendance_daily_summaries (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, employee_id bigint NOT NULL REFERENCES employees(id),
 work_date date NOT NULL, schedule_id bigint REFERENCES employee_shift_schedules(id),
 first_check_in timestamptz, last_check_out timestamptz, worked_minutes integer,
 late_minutes integer NOT NULL DEFAULT 0, early_leave_minutes integer NOT NULL DEFAULT 0,
 overtime_minutes integer NOT NULL DEFAULT 0, status varchar(25) NOT NULL,
 notes text, calculated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(employee_id,work_date)
);
COMMENT ON TABLE attendance_daily_summaries IS 'Hasil olahan event mentah untuk dashboard; dapat dihitung ulang kapan saja.';

-- CUTI DAN IZIN
CREATE TABLE leave_types (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, organization_id bigint NOT NULL REFERENCES organizations(id),
 code varchar(30) NOT NULL, name varchar(100) NOT NULL, category varchar(20) NOT NULL CHECK (category IN ('leave','permission','sick','official_duty','other')),
 unit varchar(10) NOT NULL DEFAULT 'day' CHECK (unit IN ('day','hour')),
 requires_attachment boolean NOT NULL DEFAULT false, attachment_rule text,
 requires_balance boolean NOT NULL DEFAULT true, default_allowance numeric(8,2), is_active boolean NOT NULL DEFAULT true,
 UNIQUE(organization_id,code)
);
COMMENT ON COLUMN leave_types.requires_attachment IS 'Untuk izin sakit dapat diwajibkan upload surat dokter.';
CREATE TABLE leave_balances (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, employee_id bigint NOT NULL REFERENCES employees(id),
 leave_type_id bigint NOT NULL REFERENCES leave_types(id), period_year smallint NOT NULL,
 opening_balance numeric(8,2) NOT NULL DEFAULT 0, earned numeric(8,2) NOT NULL DEFAULT 0,
 used numeric(8,2) NOT NULL DEFAULT 0, adjustment numeric(8,2) NOT NULL DEFAULT 0,
 UNIQUE(employee_id,leave_type_id,period_year)
);
CREATE TABLE leave_requests (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, organization_id bigint NOT NULL REFERENCES organizations(id),
 employee_id bigint NOT NULL REFERENCES employees(id), leave_type_id bigint NOT NULL REFERENCES leave_types(id),
 request_no varchar(60) NOT NULL, start_at timestamptz NOT NULL, end_at timestamptz NOT NULL,
 requested_units numeric(8,2) NOT NULL CHECK (requested_units > 0), reason text,
 status varchar(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','rejected','cancelled')),
 submitted_at timestamptz, decided_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,request_no), CHECK(end_at >= start_at)
);
CREATE TABLE leave_request_attachments (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, leave_request_id bigint NOT NULL REFERENCES leave_requests(id) ON DELETE CASCADE,
 document_id bigint NOT NULL REFERENCES employee_documents(id), attachment_type varchar(40) NOT NULL DEFAULT 'supporting_document'
);
CREATE TABLE leave_approvals (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, leave_request_id bigint NOT NULL REFERENCES leave_requests(id) ON DELETE CASCADE,
 sequence_no smallint NOT NULL, approver_user_id bigint NOT NULL REFERENCES users(id),
 decision varchar(20) NOT NULL DEFAULT 'pending' CHECK (decision IN ('pending','approved','rejected','skipped')),
 decided_at timestamptz, notes text, UNIQUE(leave_request_id,sequence_no)
);

-- AUDIT DAN INTEGRASI
CREATE TABLE audit_logs (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, organization_id bigint REFERENCES organizations(id), actor_user_id bigint REFERENCES users(id),
 action varchar(50) NOT NULL, entity_type varchar(80) NOT NULL, entity_id text NOT NULL,
 before_data jsonb, after_data jsonb, ip_address inet, user_agent text, occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_audit_entity ON audit_logs(entity_type,entity_id,occurred_at DESC);

CREATE TABLE integration_outbox (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, organization_id bigint REFERENCES organizations(id),
 event_type varchar(100) NOT NULL, aggregate_type varchar(80) NOT NULL, aggregate_id bigint NOT NULL,
 payload jsonb NOT NULL, occurred_at timestamptz NOT NULL DEFAULT now(), published_at timestamptz,
 attempts integer NOT NULL DEFAULT 0, last_error text
);
CREATE INDEX ix_outbox_pending ON integration_outbox(occurred_at) WHERE published_at IS NULL;

COMMENT ON TABLE roles IS 'Master role RBAC seperti superadmin, admin HRD, direksi, dan staff.';
COMMENT ON TABLE permissions IS 'Master hak akses granular yang diperiksa backend.';
COMMENT ON TABLE role_permissions IS 'Relasi banyak-ke-banyak antara role dan permission.';
COMMENT ON TABLE employee_contacts IS 'Email, telepon, WhatsApp, dan alamat pegawai.';
COMMENT ON TABLE employee_social_accounts IS 'Daftar akun media sosial pegawai.';
COMMENT ON TABLE education_levels IS 'Master jenjang pendidikan terurut.';
COMMENT ON TABLE employee_educations IS 'Riwayat pendidikan dan penanda pendidikan tertinggi pegawai.';
COMMENT ON TABLE employee_emergency_contacts IS 'Kontak darurat pegawai.';
COMMENT ON TABLE employee_documents IS 'Metadata file pegawai yang tersimpan privat di bawah folder uploads/.';
COMMENT ON TABLE employment_types IS 'Master jenis hubungan kerja seperti PKWTT, PKWT, PHL, dan THL.';
COMMENT ON TABLE disciplinary_action_types IS 'Master tingkat teguran atau tindakan disiplin.';
COMMENT ON TABLE work_shifts IS 'Master jam kerja dan toleransi keterlambatan.';
COMMENT ON TABLE employee_shift_schedules IS 'Jadwal shift harian setiap pegawai.';
COMMENT ON TABLE attendance_devices IS 'Sumber/perangkat absensi web, mobile, fingerprint, atau integrasi.';
COMMENT ON TABLE attendance_events IS 'Event absensi mentah dan tidak boleh ditimpa oleh hasil rekap.';
COMMENT ON TABLE leave_types IS 'Master cuti/izin termasuk kewajiban lampiran surat dokter.';
COMMENT ON TABLE leave_balances IS 'Saldo cuti per pegawai, jenis, dan tahun.';
COMMENT ON TABLE leave_requests IS 'Permohonan cuti atau izin pegawai.';
COMMENT ON TABLE leave_request_attachments IS 'Dokumen pendukung permohonan, termasuk surat dokter.';
COMMENT ON TABLE leave_approvals IS 'Tahapan dan keputusan persetujuan permohonan.';
COMMENT ON TABLE audit_logs IS 'Jejak perubahan dan tindakan penting untuk keamanan dan akuntabilitas.';
COMMENT ON TABLE integration_outbox IS 'Antrian event transaksional untuk mobile dan integrasi sistem lain.';

-- VIEW UNTUK DASHBOARD DIREKSI/HRD
CREATE VIEW v_employee_current_profile AS
SELECT e.id,e.organization_id,e.employee_no,e.full_name,e.national_id,e.birth_place,e.birth_date,
       CASE WHEN e.birth_date IS NULL THEN NULL ELSE extract(year from age(current_date,e.birth_date))::int END AS age_years,
       e.gender,e.religion,e.marital_status,e.employment_status,e.joined_date,
       p.name AS current_position,ou.name AS current_org_unit,l.name AS current_location,
       a.start_date AS assignment_start_date
FROM employees e
LEFT JOIN employee_assignments a ON a.employee_id=e.id AND a.end_date IS NULL AND a.assignment_type='primary'
LEFT JOIN positions p ON p.id=a.position_id LEFT JOIN org_units ou ON ou.id=a.org_unit_id LEFT JOIN locations l ON l.id=a.location_id
WHERE e.deleted_at IS NULL;

CREATE VIEW v_employee_active_warnings AS
SELECT da.*,dat.code AS warning_code,dat.name AS warning_name
FROM disciplinary_actions da JOIN disciplinary_action_types dat ON dat.id=da.action_type_id
WHERE da.status='active' AND da.effective_from<=current_date AND (da.effective_until IS NULL OR da.effective_until>=current_date);

-- SEED MINIMAL
INSERT INTO roles(code,name,scope,is_system) VALUES
 ('superadmin','Super Administrator','platform',true),('admin','Administrator HRD','organization',true),
 ('director','Direksi','organization',true),('staff','Karyawan','self',true);
INSERT INTO employment_types(code,name,requires_contract_end) VALUES
 ('PKWTT','Karyawan Tetap',false),('PKWT','Perjanjian Kerja Waktu Tertentu',true),
 ('PHL','Pekerja Harian Lepas',true),('THL','Tenaga Harian Lepas',true),
 ('TECHNICAL','Tenaga Teknis',true),('SPECIAL_STAFF','Staf Khusus',true);
INSERT INTO education_levels(code,name,rank_no) VALUES
 ('SD','Sekolah Dasar',1),('SMP','Sekolah Menengah Pertama',2),('SMA','SMA/SMK',3),
 ('D1','Diploma 1',4),('D2','Diploma 2',5),('D3','Diploma 3',6),('D4','Diploma 4',7),
 ('S1','Sarjana',8),('S2','Magister',9),('S3','Doktor',10);
INSERT INTO disciplinary_action_types(code,name,severity,default_valid_months) VALUES
 ('SP1','Surat Peringatan Pertama',1,6),('SP2','Surat Peringatan Kedua',2,6),('SP3','Surat Peringatan Ketiga',3,6);

-- updated_at triggers
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['organizations','subscription_plans','organization_subscriptions','locations','org_units','positions','users','employees','leave_requests'] LOOP
  EXECUTE format('CREATE TRIGGER trg_%I_updated BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()',t,t);
 END LOOP;
END $$;

COMMIT;
