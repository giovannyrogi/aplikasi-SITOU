-- ============================================================================
-- SITOU - PostgreSQL 18 schema v3
-- Sistem Informasi Tenaga Operasional Unit - by Perumda Pasar Manado
-- Tujuan: HRIS multi-organisasi, siap dashboard saat ini dan mobile attendance.
-- Konvensi: seluruh waktu absolut memakai timestamptz; tanggal bisnis mengikuti
-- timezone organisasi. File privat disimpan di storage, database menyimpan metadata.
-- ============================================================================

BEGIN;

-- citext membuat email tidak peka huruf besar/kecil.
CREATE EXTENSION IF NOT EXISTS citext;
-- pg_trgm mempercepat pencarian nama/kode memakai ILIKE.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Fungsi umum untuk mengisi updated_at tanpa mengulang logika di aplikasi.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 1. ORGANISASI, FILE PRIVAT, BRANDING, DAN STRUKTUR ORGANISASI
-- ============================================================================

CREATE TABLE organizations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- ID internal organisasi.
  parent_id bigint REFERENCES organizations(id), -- Induk organisasi bila berbentuk grup/holding.
  code varchar(30) NOT NULL UNIQUE, -- Kode organisasi stabil untuk integrasi dan URL internal.
  name varchar(200) NOT NULL, -- Nama tampilan organisasi.
  legal_name varchar(250), -- Nama badan hukum lengkap.
  organization_type varchar(30) NOT NULL DEFAULT 'company' CHECK (organization_type IN ('holding','company','agency')), -- Jenis organisasi.
  timezone varchar(50) NOT NULL DEFAULT 'Asia/Makassar', -- Zona waktu untuk tanggal kerja dan rekap.
  locale varchar(10) NOT NULL DEFAULT 'id-ID', -- Lokal antarmuka dan format data.
  is_active boolean NOT NULL DEFAULT true, -- Status administratif organisasi; masa akses SITOU diperiksa dari organization_subscriptions.
  settings jsonb NOT NULL DEFAULT '{}'::jsonb, -- Konfigurasi tambahan noninti yang tervalidasi aplikasi.
  created_at timestamptz NOT NULL DEFAULT now(), -- Waktu pembuatan record.
  updated_at timestamptz NOT NULL DEFAULT now(), -- Waktu perubahan terakhir.
  CONSTRAINT uq_organizations_tenant_id UNIQUE (id)
);
COMMENT ON TABLE organizations IS 'Identitas organisasi. Histori masa penggunaan SITOU disimpan pada organization_subscriptions.';

CREATE TABLE organization_subscriptions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- ID unik setiap periode langganan atau masa penggunaan SITOU.
  organization_id bigint NOT NULL REFERENCES organizations(id), -- Organisasi pemilik periode langganan.
  starts_on date NOT NULL, -- Tanggal pertama organisasi boleh menggunakan SITOU pada periode ini.
  ends_on date NOT NULL, -- Tanggal terakhir organisasi boleh menggunakan SITOU pada periode ini dan bersifat inklusif.
  grace_ends_on date, -- Akhir masa tenggang setelah ends_on; NULL berarti tidak ada masa tenggang.
  status varchar(20) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','active','grace','expired','suspended','cancelled')), -- Status periode langganan.
  notes text, -- Catatan perpanjangan, penghentian, atau informasi administratif lainnya.
  created_by_user_id bigint, -- User superadmin pembuat periode; foreign key ditambahkan setelah tabel users dibuat.
  request_id uuid, -- Kunci idempotensi mutation pembentukan periode; NULL hanya untuk backfill/migration.
  created_at timestamptz NOT NULL DEFAULT now(), -- Waktu record periode langganan dibuat.
  updated_at timestamptz NOT NULL DEFAULT now(), -- Waktu record periode langganan terakhir diubah.
  CONSTRAINT uq_organization_subscriptions_org_id UNIQUE (organization_id,id),
  CONSTRAINT uq_organization_subscriptions_request UNIQUE (organization_id,request_id),
  CONSTRAINT ck_organization_subscription_dates CHECK (ends_on >= starts_on),
  CONSTRAINT ck_organization_subscription_grace CHECK (grace_ends_on IS NULL OR grace_ends_on >= ends_on),
  CONSTRAINT ex_organization_subscriptions_period EXCLUDE USING gist (
    organization_id WITH =,
    daterange(starts_on,COALESCE(grace_ends_on,ends_on),'[]') WITH &&
  ) WHERE (status NOT IN ('suspended','cancelled'))
);
COMMENT ON TABLE organization_subscriptions IS 'Histori masa penggunaan SITOU per organisasi; perpanjangan membuat record baru dan tidak menimpa periode lama.';

-- Mempercepat pemeriksaan akses organisasi dan pembacaan histori langganan.
CREATE INDEX ix_organization_subscriptions_access
ON organization_subscriptions(organization_id,status,starts_on,ends_on,grace_ends_on);

-- Mempercepat dashboard daftar organisasi aktif yang segera berakhir.
CREATE INDEX ix_organization_subscriptions_expiring
ON organization_subscriptions(ends_on,organization_id)
WHERE status = 'active';

CREATE TABLE stored_files (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- ID metadata file privat.
  organization_id bigint NOT NULL REFERENCES organizations(id), -- Pemilik file dan batas organisasi.
  employee_id bigint, -- Pegawai pemilik file bila file merupakan dokumen kepegawaian.
  onboarding_draft_id bigint, -- Draft onboarding pemilik file sebelum pegawai difinalisasi.
  storage_provider varchar(30) NOT NULL DEFAULT 'local_private' CHECK (storage_provider IN ('local_private','s3','r2','azure_blob','other')), -- Backend penyimpanan.
  object_key text NOT NULL, -- Kunci relatif privat; bukan URL publik atau path absolut.
  original_name text NOT NULL, -- Nama file saat diunggah pengguna.
  mime_type varchar(150) NOT NULL, -- MIME type hasil validasi server.
  size_bytes bigint NOT NULL CHECK (size_bytes >= 0), -- Ukuran file untuk limit dan audit.
  sha256 char(64), -- Hash integritas dan deteksi duplikasi.
  category varchar(40) NOT NULL CONSTRAINT ck_stored_files_category CHECK (category IN ('logo','employee_photo','attendance_photo','medical_letter','leave_attachment','contract','assignment_decree','discipline_letter','identity','education','other')), -- Kelompok kegunaan file.
  is_confidential boolean NOT NULL DEFAULT true, -- Menandai file membutuhkan izin sensitif.
  uploaded_by_user_id bigint, -- User pengunggah; FK ditambahkan setelah tabel users.
  created_at timestamptz NOT NULL DEFAULT now(), -- Waktu file diregistrasikan.
  deleted_at timestamptz, -- Soft delete metadata; objek dihapus melalui retention job.
  CONSTRAINT uq_stored_files_org_id UNIQUE (organization_id,id),
  CONSTRAINT uq_stored_files_object UNIQUE (storage_provider,object_key),
  CONSTRAINT ck_stored_files_key CHECK (object_key !~ '(^/|\\.\\.)')
);
COMMENT ON TABLE stored_files IS 'Metadata file privat. Byte file tidak disimpan di tabel dan hanya diakses melalui API berizin.';

CREATE TABLE organization_branding (
  organization_id bigint PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE, -- Organisasi pemilik branding.
  logo_file_id bigint NOT NULL, -- Logo organisasi pada stored_files.
  primary_color varchar(7) DEFAULT '#E30613' CHECK (primary_color ~ '^#[0-9A-Fa-f]{6}$'), -- Warna utama heksadesimal.
  secondary_color varchar(7) DEFAULT '#FFFFFF' CHECK (secondary_color ~ '^#[0-9A-Fa-f]{6}$'), -- Warna sekunder heksadesimal.
  updated_at timestamptz NOT NULL DEFAULT now(), -- Waktu branding terakhir diubah.
  CONSTRAINT fk_branding_logo FOREIGN KEY (organization_id,logo_file_id) REFERENCES stored_files(organization_id,id)
);
COMMENT ON TABLE organization_branding IS 'Logo dan warna berbeda untuk setiap organisasi.';

CREATE TABLE locations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- ID kantor/cabang/unit pasar/lokasi kerja.
  organization_id bigint NOT NULL REFERENCES organizations(id), -- Organisasi pemilik lokasi.
  parent_location_id bigint, -- Lokasi induk untuk hierarki area.
  code varchar(30) NOT NULL, -- Kode lokasi unik dalam organisasi.
  name varchar(200) NOT NULL, -- Nama lokasi.
  location_type varchar(30) NOT NULL DEFAULT 'branch' CHECK (location_type IN ('head_office','branch','market','site','warehouse','other')), -- Jenis lokasi.
  address text, -- Alamat lengkap lokasi.
  latitude numeric(10,7) CHECK (latitude BETWEEN -90 AND 90), -- Koordinat pusat informatif.
  longitude numeric(10,7) CHECK (longitude BETWEEN -180 AND 180), -- Koordinat pusat informatif.
  logo_file_id bigint, -- Logo khusus lokasi bila berbeda; NULL memakai logo organisasi.
  operational_from date NOT NULL DEFAULT current_date, -- Tanggal lokasi mulai beroperasi atau mulai digunakan dalam struktur organisasi.
  operational_until date, -- Tanggal terakhir lokasi beroperasi; NULL berarti masih beroperasi.
  is_active boolean NOT NULL DEFAULT true, -- Menentukan apakah lokasi boleh dipilih pada transaksi dan penempatan baru.
  created_at timestamptz NOT NULL DEFAULT now(), -- Waktu record dibuat.
  updated_at timestamptz NOT NULL DEFAULT now(), -- Waktu record terakhir diubah.
  CONSTRAINT uq_locations_org_code UNIQUE (organization_id,code),
  CONSTRAINT uq_locations_org_id UNIQUE (organization_id,id),
  CONSTRAINT fk_locations_parent FOREIGN KEY (organization_id,parent_location_id) REFERENCES locations(organization_id,id),
  CONSTRAINT fk_locations_logo FOREIGN KEY (organization_id,logo_file_id) REFERENCES stored_files(organization_id,id),
  CONSTRAINT ck_locations_operational_dates CHECK (operational_until IS NULL OR operational_until >= operational_from)
);
COMMENT ON TABLE locations IS 'Kantor pusat, cabang, pasar, site, dan lokasi kerja; periode tanggal menunjukkan umur operasional, bukan masa langganan SITOU.';

CREATE TABLE organization_unit_types (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- ID master jenis unit organisasi.
  organization_id bigint NOT NULL REFERENCES organizations(id), -- Organisasi pemilik jenis unit.
  code varchar(40) NOT NULL, -- Kode stabil uppercase untuk integrasi dan validasi.
  name varchar(100) NOT NULL, -- Nama jenis yang ditampilkan pada UI.
  description text, -- Penjelasan penggunaan jenis unit.
  sort_order smallint NOT NULL DEFAULT 100, -- Urutan pilihan pada UI.
  is_active boolean NOT NULL DEFAULT true, -- Jenis nonaktif dipertahankan untuk histori.
  created_at timestamptz NOT NULL DEFAULT now(), -- Waktu dibuat.
  updated_at timestamptz NOT NULL DEFAULT now(), -- Waktu diubah.
  CONSTRAINT uq_organization_unit_types_org_code UNIQUE (organization_id,code),
  CONSTRAINT uq_organization_unit_types_org_id UNIQUE (organization_id,id),
  CONSTRAINT ck_organization_unit_types_code CHECK (code = btrim(code) AND code ~ '^[A-Z][A-Z0-9_]*$'),
  CONSTRAINT ck_organization_unit_types_name CHECK (name = btrim(name) AND char_length(name) BETWEEN 2 AND 100),
  CONSTRAINT ck_organization_unit_types_sort_order CHECK (sort_order >= 0)
);
COMMENT ON TABLE organization_unit_types IS 'Master jenis struktur organisasi yang dapat disesuaikan pada setiap organisasi.';
CREATE UNIQUE INDEX uq_organization_unit_types_org_name_ci ON organization_unit_types(organization_id,lower(btrim(name)));
CREATE INDEX ix_organization_unit_types_active_list ON organization_unit_types(organization_id,sort_order,name,id) WHERE is_active=true;

CREATE TABLE organization_units (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- ID unit organisasi.
  organization_id bigint NOT NULL REFERENCES organizations(id), -- Organisasi pemilik unit.
  parent_unit_id bigint, -- Unit induk untuk struktur bertingkat.
  code varchar(30) NOT NULL, -- Kode unik unit dalam organisasi.
  name varchar(200) NOT NULL, -- Nama unit/divisi/departemen.
  unit_type_id bigint NOT NULL, -- Jenis unit dari master fleksibel milik organisasi yang sama.
  is_active boolean NOT NULL DEFAULT true, -- Status master unit.
  created_at timestamptz NOT NULL DEFAULT now(), -- Waktu dibuat.
  updated_at timestamptz NOT NULL DEFAULT now(), -- Waktu diubah.
  CONSTRAINT uq_units_org_code UNIQUE (organization_id,code),
  CONSTRAINT uq_units_org_id UNIQUE (organization_id,id),
  CONSTRAINT fk_units_parent FOREIGN KEY (organization_id,parent_unit_id) REFERENCES organization_units(organization_id,id),
  CONSTRAINT fk_organization_units_type FOREIGN KEY (organization_id,unit_type_id) REFERENCES organization_unit_types(organization_id,id)
);
COMMENT ON TABLE organization_units IS 'Struktur organisasi bertingkat dengan klasifikasi fleksibel dari organization_unit_types dan cakupan lokasi many-to-many.';
CREATE INDEX ix_organization_units_type ON organization_units(organization_id,unit_type_id);

CREATE TABLE organization_unit_locations (
  organization_id bigint NOT NULL REFERENCES organizations(id), -- Batas organisasi pada relasi.
  organization_unit_id bigint NOT NULL, -- Divisi/unit yang beroperasi di lokasi.
  location_id bigint NOT NULL, -- Cabang/lokasi tempat unit beroperasi.
  is_primary boolean NOT NULL DEFAULT false, -- Menandai lokasi utama unit.
  active_from date NOT NULL, -- Awal relasi berlaku dan wajib ditentukan eksplisit.
  active_until date, -- Akhir relasi berlaku.
  PRIMARY KEY (organization_id,organization_unit_id,location_id,active_from),
  CONSTRAINT fk_unit_locations_unit FOREIGN KEY (organization_id,organization_unit_id) REFERENCES organization_units(organization_id,id),
  CONSTRAINT fk_unit_locations_location FOREIGN KEY (organization_id,location_id) REFERENCES locations(organization_id,id),
  CONSTRAINT ck_unit_locations_dates CHECK (active_until IS NULL OR active_until >= active_from),
  CONSTRAINT ex_unit_locations_period EXCLUDE USING gist (
    organization_id WITH =,
    organization_unit_id WITH =,
    location_id WITH =,
    daterange(active_from,COALESCE(active_until,'infinity'::date),'[]') WITH &&
  )
);
COMMENT ON TABLE organization_unit_locations IS 'Relasi periode many-to-many agar satu unit dapat beroperasi di beberapa lokasi tanpa menimpa histori.';
COMMENT ON COLUMN organization_unit_locations.active_from IS 'Tanggal efektif eksplisit ketika unit mulai beroperasi pada lokasi; tidak memakai tanggal pencatatan otomatis.';

CREATE TABLE positions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- ID master jabatan.
  organization_id bigint NOT NULL REFERENCES organizations(id), -- Organisasi pemilik jabatan.
  code varchar(30) NOT NULL, -- Kode jabatan unik per organisasi.
  name varchar(200) NOT NULL, -- Nama jabatan.
  grade varchar(50), -- Golongan/grade opsional.
  level_no smallint, -- Urutan level untuk laporan struktur.
  is_managerial boolean NOT NULL DEFAULT false, -- Penanda jabatan pimpinan/manajerial.
  is_active boolean NOT NULL DEFAULT true, -- Status master jabatan.
  created_at timestamptz NOT NULL DEFAULT now(), -- Waktu dibuat.
  updated_at timestamptz NOT NULL DEFAULT now(), -- Waktu diubah.
  CONSTRAINT uq_positions_org_code UNIQUE (organization_id,code),
  CONSTRAINT uq_positions_org_id UNIQUE (organization_id,id)
);
COMMENT ON TABLE positions IS 'Master jabatan terpisah dari pegawai agar histori rolling, mutasi, promosi, dan demosi tetap utuh.';

-- ============================================================================
-- 2. USER, ROLE, DAN BATAS AKSES
-- ============================================================================

CREATE TABLE users (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username citext NOT NULL UNIQUE,
  password_hash text,
  is_active boolean NOT NULL DEFAULT true,
  credential_version integer NOT NULL DEFAULT 1 CHECK (credential_version > 0),
  last_login_at timestamptz,
  last_login_ip inet,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE users IS 'Kredensial global. Identitas berasal dari profil pegawai atau profil platform.';

CREATE TABLE platform_user_profiles (
  user_id bigint PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  full_name varchar(200) NOT NULL,
  email citext,
  whatsapp varchar(30),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_platform_profiles_whatsapp CHECK (whatsapp IS NULL OR whatsapp ~ '^\+628[1-9][0-9]{7,10}$')
);
CREATE UNIQUE INDEX uq_platform_profiles_email ON platform_user_profiles(email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX uq_platform_profiles_whatsapp ON platform_user_profiles(whatsapp) WHERE whatsapp IS NOT NULL;
COMMENT ON TABLE platform_user_profiles IS 'Identitas Superadmin/platform yang tidak memiliki profil pegawai organisasi.';
ALTER TABLE organization_subscriptions
  ADD CONSTRAINT fk_organization_subscriptions_creator
  FOREIGN KEY (created_by_user_id) REFERENCES users(id);

ALTER TABLE stored_files
  ADD CONSTRAINT fk_stored_files_uploader FOREIGN KEY (uploaded_by_user_id) REFERENCES users(id);

CREATE TABLE roles (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- ID role.
  code varchar(40) NOT NULL UNIQUE, -- Kode role stabil: superadmin, leader, hrd, employee.
  name varchar(100) NOT NULL, -- Nama role untuk UI.
  scope varchar(20) NOT NULL CHECK (scope IN ('platform','organization','self')), -- Cakupan role.
  description text, -- Penjelasan kewenangan role.
  is_system boolean NOT NULL DEFAULT false -- Role bawaan tidak boleh dihapus sembarang.
);
COMMENT ON TABLE roles IS 'Role dasar platform: superadmin, pimpinan, HRD, dan pegawai.';

CREATE TABLE permissions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- ID permission.
  code varchar(100) NOT NULL UNIQUE, -- Kode permission modul.aksi.
  description text -- Penjelasan hak akses.
);
COMMENT ON TABLE permissions IS 'Hak akses granular yang wajib diperiksa server, bukan hanya disembunyikan di UI.';

CREATE TABLE role_permissions (
  role_id bigint NOT NULL REFERENCES roles(id) ON DELETE CASCADE, -- Role penerima izin.
  permission_id bigint NOT NULL REFERENCES permissions(id) ON DELETE CASCADE, -- Izin yang diberikan.
  PRIMARY KEY (role_id,permission_id)
);
COMMENT ON TABLE role_permissions IS 'Relasi role dan permission.';

CREATE TABLE user_organization_roles (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- ID penugasan role.
  user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- Akun yang menerima role.
  organization_id bigint REFERENCES organizations(id) ON DELETE CASCADE, -- Organisasi; NULL hanya untuk superadmin platform.
  role_id bigint NOT NULL REFERENCES roles(id), -- Role yang diberikan.
  location_scope_mode varchar(20) NOT NULL DEFAULT 'selected' CHECK (location_scope_mode IN ('all','selected')), -- Mode eksplisit mencegah akses penuh karena scope kosong.
  active_from timestamptz NOT NULL DEFAULT now(), -- Awal role berlaku.
  active_until timestamptz, -- Akhir role berlaku.
  created_by_user_id bigint REFERENCES users(id), -- Superadmin/HRD pemberi role.
  CONSTRAINT uq_user_org_roles_org_id UNIQUE (organization_id,id),
  CONSTRAINT ck_user_roles_dates CHECK (active_until IS NULL OR active_until > active_from)
);
COMMENT ON TABLE user_organization_roles IS 'Role akun per organisasi; organization_id NULL hanya untuk role platform.';
CREATE UNIQUE INDEX uq_user_org_role ON user_organization_roles(user_id,organization_id,role_id) WHERE organization_id IS NOT NULL;
CREATE UNIQUE INDEX uq_user_platform_role ON user_organization_roles(user_id,role_id) WHERE organization_id IS NULL;
CREATE INDEX ix_user_roles_active ON user_organization_roles(organization_id,user_id,active_until);

CREATE TABLE user_location_scopes (
  user_organization_role_id bigint NOT NULL REFERENCES user_organization_roles(id) ON DELETE CASCADE, -- Role organisasi yang dibatasi.
  organization_id bigint NOT NULL REFERENCES organizations(id), -- Batas organisasi eksplisit.
  location_id bigint NOT NULL, -- Lokasi yang boleh diakses akun.
  PRIMARY KEY (user_organization_role_id,location_id),
  CONSTRAINT fk_user_location_role FOREIGN KEY (organization_id,user_organization_role_id) REFERENCES user_organization_roles(organization_id,id),
  CONSTRAINT fk_user_location_scope FOREIGN KEY (organization_id,location_id) REFERENCES locations(organization_id,id)
);
COMMENT ON TABLE user_location_scopes IS 'Pembatas akses lokasi bagi admin/pimpinan bila tidak berhak melihat seluruh organisasi.';

-- ============================================================================
-- 3. DATA PEGAWAI DAN HISTORI KEPEGAWAIAN
-- ============================================================================

CREATE TABLE employees (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- ID pegawai internal.
  organization_id bigint NOT NULL REFERENCES organizations(id), -- Organisasi pemilik pegawai.
  employee_no varchar(60) NOT NULL, -- NIP; teks agar nol awal tidak hilang.
  user_id bigint UNIQUE REFERENCES users(id), -- Akun self-service pegawai bila sudah dibuat.
  full_name varchar(200) NOT NULL, -- Nama lengkap.
  preferred_name varchar(100), -- Nama panggilan.
  national_id varchar(30) NOT NULL CONSTRAINT ck_employees_national_id CHECK (national_id ~ '^[0-9]{16}$'), -- NIK canonical 16 digit wajib; akses wajib dimasking sesuai permission.
  birth_place varchar(120), -- Tempat lahir.
  birth_date date, -- Tanggal lahir; umur dihitung saat query.
  gender varchar(20) CHECK (gender IN ('male','female','other','undisclosed')), -- Jenis kelamin terstruktur.
  religion varchar(50), -- Agama sesuai data administrasi.
  marital_status varchar(30) CONSTRAINT ck_employees_marital_status CHECK (marital_status IS NULL OR marital_status IN ('single','married','divorced','widowed')), -- Status perkawinan memakai kode stabil; label UI berbahasa Indonesia.
  blood_type varchar(3), -- Golongan darah.
  nationality varchar(60) NOT NULL DEFAULT 'Indonesia', -- Kewarganegaraan.
  joined_date date, -- Tanggal pertama bergabung untuk hitung masa kerja.
  employment_status varchar(30) NOT NULL DEFAULT 'draft' CONSTRAINT ck_employees_employment_status CHECK (employment_status IN ('draft','active','probation','suspended','terminated','retired','deceased')), -- Status hubungan kerja; cuti dan izin berasal dari leave_requests.
  termination_date date, -- Tanggal hubungan kerja berakhir.
  termination_reason text, -- Alasan pengakhiran.
  profile_photo_file_id bigint, -- Foto profil privat.
  created_at timestamptz NOT NULL DEFAULT now(), -- Waktu data dibuat.
  updated_at timestamptz NOT NULL DEFAULT now(), -- Waktu data diubah.
  deleted_at timestamptz, -- Soft delete untuk mencegah hilangnya histori.
  CONSTRAINT uq_employees_org_number UNIQUE (organization_id,employee_no),
  CONSTRAINT uq_employees_org_id UNIQUE (organization_id,id),
  CONSTRAINT fk_employees_photo FOREIGN KEY (organization_id,profile_photo_file_id) REFERENCES stored_files(organization_id,id),
  CONSTRAINT ck_employees_dates CHECK (termination_date IS NULL OR joined_date IS NULL OR termination_date >= joined_date)
);
COMMENT ON TABLE employees IS 'Profil inti pegawai. Posisi, lokasi, dan divisi saat ini berasal dari histori employee_assignments.';
ALTER TABLE stored_files
  ADD CONSTRAINT fk_stored_files_employee FOREIGN KEY (organization_id,employee_id) REFERENCES employees(organization_id,id);
CREATE INDEX ix_stored_files_employee ON stored_files(organization_id,employee_id,created_at DESC) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX uq_employees_org_number_normalized ON employees(organization_id,upper(btrim(employee_no)));
CREATE UNIQUE INDEX uq_employees_org_nik ON employees(organization_id,national_id) WHERE national_id IS NOT NULL;
CREATE INDEX ix_employees_org_status ON employees(organization_id,employment_status,id) WHERE deleted_at IS NULL;
CREATE INDEX ix_employees_name_trgm ON employees USING gin(full_name gin_trgm_ops) WHERE deleted_at IS NULL;
CREATE INDEX ix_employees_org_joined ON employees(organization_id,joined_date DESC) WHERE deleted_at IS NULL;

CREATE TABLE employee_contacts (
  organization_id bigint NOT NULL REFERENCES organizations(id), -- Batas organisasi.
  employee_id bigint PRIMARY KEY, -- Pegawai pemilik kontak.
  personal_email citext, -- Email pribadi.
  work_email citext, -- Email organisasi.
  phone varchar(30), -- Nomor telepon.
  whatsapp varchar(30), -- Nomor WhatsApp E.164 Indonesia, misalnya +628123456789.
  ktp_address text, -- Alamat sesuai KTP.
  domicile_address text, -- Alamat domisili.
  village varchar(100), -- Kelurahan/desa.
  district varchar(100), -- Kecamatan.
  city varchar(100), -- Kota/kabupaten.
  province varchar(100), -- Provinsi.
  postal_code varchar(10), -- Kode pos.
  updated_at timestamptz NOT NULL DEFAULT now(), -- Waktu perubahan terakhir.
  CONSTRAINT fk_employee_contacts_employee FOREIGN KEY (organization_id,employee_id) REFERENCES employees(organization_id,id) ON DELETE CASCADE,
  CONSTRAINT ck_employee_contacts_whatsapp_e164 CHECK (whatsapp IS NULL OR whatsapp ~ '^\+628[1-9][0-9]{7,10}$')
);
COMMENT ON TABLE employee_contacts IS 'Kontak dan alamat pegawai; dipisahkan agar hak akses data sensitif lebih mudah.';

CREATE TABLE employee_identifiers (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- ID identitas administrasi.
  organization_id bigint NOT NULL REFERENCES organizations(id), -- Batas organisasi.
  employee_id bigint NOT NULL, -- Pemilik identitas.
  identifier_type varchar(40) NOT NULL CHECK (identifier_type IN ('bpjs_health','bpjs_employment','tax_npwp','family_card','passport','other')), -- Jenis nomor identitas selain KTP yang tetap bersumber dari employees.national_id.
  identifier_label varchar(100), -- Nama identitas khusus ketika jenisnya other.
  identifier_value varchar(100) NOT NULL, -- Nilai nomor; wajib dimasking pada list umum.
  issued_at date, -- Tanggal diterbitkan.
  expires_at date, -- Tanggal kedaluwarsa.
  is_verified boolean NOT NULL DEFAULT false, -- Status verifikasi HRD.
  document_file_id bigint, -- Foto atau PDF identitas privat.
  CONSTRAINT fk_employee_identifiers_employee FOREIGN KEY (organization_id,employee_id) REFERENCES employees(organization_id,id) ON DELETE CASCADE,
  CONSTRAINT fk_employee_identifier_file FOREIGN KEY (organization_id,document_file_id) REFERENCES stored_files(organization_id,id),
  CONSTRAINT uq_employee_identifier UNIQUE (employee_id,identifier_type,identifier_value),
  CONSTRAINT ck_employee_identifier_label CHECK (identifier_type <> 'other' OR identifier_label IS NOT NULL)
);
COMMENT ON TABLE employee_identifiers IS 'BPJS Kesehatan, BPJS Ketenagakerjaan, NPWP, dan identitas lain.';
CREATE INDEX ix_identifiers_employee_type ON employee_identifiers(organization_id,employee_id,identifier_type);
CREATE INDEX ix_employee_identifiers_file ON employee_identifiers(organization_id,document_file_id) WHERE document_file_id IS NOT NULL;

CREATE TABLE employee_bank_accounts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- ID rekening.
  organization_id bigint NOT NULL REFERENCES organizations(id), -- Batas organisasi.
  employee_id bigint NOT NULL, -- Pegawai pemilik rekening.
  bank_name varchar(100) NOT NULL, -- Nama bank.
  account_number varchar(100) NOT NULL, -- Nomor rekening; wajib dimasking.
  account_holder varchar(200) NOT NULL, -- Nama pemilik rekening.
  is_primary boolean NOT NULL DEFAULT true, -- Rekening utama pembayaran.
  verified_at timestamptz, -- Waktu diverifikasi HRD.
  CONSTRAINT fk_bank_employee FOREIGN KEY (organization_id,employee_id) REFERENCES employees(organization_id,id) ON DELETE CASCADE
);
COMMENT ON TABLE employee_bank_accounts IS 'Rekening pegawai sebagai data sangat sensitif.';
CREATE UNIQUE INDEX uq_employee_primary_bank ON employee_bank_accounts(employee_id) WHERE is_primary;

CREATE TABLE employee_dependents (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- ID anggota keluarga/tanggungan.
  organization_id bigint NOT NULL REFERENCES organizations(id), -- Batas organisasi.
  employee_id bigint NOT NULL, -- Pegawai terkait.
  relationship varchar(30) NOT NULL CHECK (relationship IN ('spouse','child','parent','sibling','other')), -- Hubungan keluarga.
  full_name varchar(200) NOT NULL, -- Nama anggota keluarga.
  birth_date date, -- Tanggal lahir.
  national_id varchar(30), -- NIK anggota keluarga; data sensitif.
  phone varchar(30), -- Nomor kontak seluler E.164 Indonesia.
  is_dependent boolean NOT NULL DEFAULT true, -- Apakah menjadi tanggungan resmi.
  is_emergency_contact boolean NOT NULL DEFAULT false, -- Apakah juga kontak darurat.
  notes text, -- Catatan administrasi.
  CONSTRAINT fk_dependents_employee FOREIGN KEY (organization_id,employee_id) REFERENCES employees(organization_id,id) ON DELETE CASCADE,
  CONSTRAINT ck_employee_dependents_phone_e164 CHECK (phone IS NULL OR phone ~ '^\+628[1-9][0-9]{7,10}$')
);
COMMENT ON TABLE employee_dependents IS 'Pasangan, anak, tanggungan, dan kontak darurat disimpan per individu.';
CREATE INDEX ix_dependents_employee ON employee_dependents(organization_id,employee_id,relationship);

CREATE TABLE employee_emergency_contacts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- ID kontak darurat.
  organization_id bigint NOT NULL REFERENCES organizations(id), -- Batas organisasi.
  employee_id bigint NOT NULL, -- Pegawai pemilik kontak.
  full_name varchar(200) NOT NULL, -- Nama kontak darurat.
  relationship varchar(50), -- Hubungan dengan pegawai.
  phone varchar(30) NOT NULL, -- Nomor seluler E.164 Indonesia yang dapat dihubungi.
  address text, -- Alamat kontak bila diperlukan.
  is_primary boolean NOT NULL DEFAULT false, -- Penanda kontak pertama yang dihubungi.
  CONSTRAINT fk_emergency_contact_employee FOREIGN KEY (organization_id,employee_id) REFERENCES employees(organization_id,id) ON DELETE CASCADE,
  CONSTRAINT ck_employee_emergency_contacts_phone_e164 CHECK (phone ~ '^\+628[1-9][0-9]{7,10}$')
);
COMMENT ON TABLE employee_emergency_contacts IS 'Kontak darurat dapat berupa keluarga atau pihak lain.';
CREATE INDEX ix_emergency_contacts_employee ON employee_emergency_contacts(organization_id,employee_id,is_primary DESC);
CREATE UNIQUE INDEX uq_employee_primary_emergency_contact ON employee_emergency_contacts(employee_id) WHERE is_primary;

CREATE TABLE employee_social_accounts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- ID akun media sosial.
  organization_id bigint NOT NULL REFERENCES organizations(id), -- Batas organisasi.
  employee_id bigint NOT NULL, -- Pegawai pemilik akun.
  platform varchar(50) NOT NULL, -- Nama platform.
  handle_or_url text NOT NULL, -- Username atau URL akun.
  CONSTRAINT fk_social_account_employee FOREIGN KEY (organization_id,employee_id) REFERENCES employees(organization_id,id) ON DELETE CASCADE,
  CONSTRAINT uq_employee_social_account UNIQUE (employee_id,platform,handle_or_url)
);
COMMENT ON TABLE employee_social_accounts IS 'Akun media sosial pegawai bila memang diperlukan administrasi organisasi.';

CREATE TABLE employee_educations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- ID riwayat pendidikan.
  organization_id bigint NOT NULL REFERENCES organizations(id), -- Batas organisasi.
  employee_id bigint NOT NULL, -- Pegawai pemilik riwayat.
  education_level varchar(30) NOT NULL, -- Jenjang pendidikan.
  institution varchar(200), -- Nama institusi.
  field_of_study varchar(150), -- Jurusan/bidang studi.
  graduation_year smallint CHECK (graduation_year BETWEEN 1900 AND 2200), -- Tahun lulus.
  is_highest boolean NOT NULL DEFAULT false, -- Penanda pendidikan tertinggi.
  certificate_file_id bigint, -- Ijazah/sertifikat privat.
  CONSTRAINT fk_education_employee FOREIGN KEY (organization_id,employee_id) REFERENCES employees(organization_id,id) ON DELETE CASCADE,
  CONSTRAINT fk_education_file FOREIGN KEY (organization_id,certificate_file_id) REFERENCES stored_files(organization_id,id)
);
COMMENT ON TABLE employee_educations IS 'Riwayat pendidikan pegawai; tidak hanya satu kolom pendidikan terakhir.';
CREATE INDEX ix_educations_employee ON employee_educations(organization_id,employee_id,is_highest DESC);
CREATE UNIQUE INDEX uq_employee_highest_education ON employee_educations(employee_id) WHERE is_highest;

CREATE TABLE employee_skills (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- ID keahlian pegawai.
  organization_id bigint NOT NULL REFERENCES organizations(id), -- Batas organisasi.
  employee_id bigint NOT NULL, -- Pegawai pemilik keahlian.
  skill_name varchar(150) NOT NULL, -- Nama keahlian.
  proficiency_level varchar(30), -- Tingkat kemampuan sesuai kamus organisasi.
  notes text, -- Catatan pengalaman atau verifikasi.
  CONSTRAINT fk_employee_skill_employee FOREIGN KEY (organization_id,employee_id) REFERENCES employees(organization_id,id) ON DELETE CASCADE,
  CONSTRAINT uq_employee_skill UNIQUE (employee_id,skill_name)
);
COMMENT ON TABLE employee_skills IS 'Daftar keahlian pegawai untuk penempatan dan pengembangan.';

CREATE TABLE employee_certifications (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- ID sertifikasi.
  organization_id bigint NOT NULL REFERENCES organizations(id), -- Batas organisasi.
  employee_id bigint NOT NULL, -- Pegawai pemilik sertifikasi.
  certification_name varchar(200) NOT NULL, -- Nama sertifikasi.
  issuer varchar(200), -- Lembaga penerbit.
  credential_no varchar(100), -- Nomor kredensial.
  issued_at date, -- Tanggal terbit.
  expires_at date, -- Tanggal kedaluwarsa.
  certificate_file_id bigint, -- File sertifikat privat.
  CONSTRAINT fk_certification_employee FOREIGN KEY (organization_id,employee_id) REFERENCES employees(organization_id,id) ON DELETE CASCADE,
  CONSTRAINT fk_certification_file FOREIGN KEY (organization_id,certificate_file_id) REFERENCES stored_files(organization_id,id),
  CONSTRAINT ck_certification_dates CHECK (expires_at IS NULL OR issued_at IS NULL OR expires_at >= issued_at)
);
COMMENT ON TABLE employee_certifications IS 'Sertifikasi profesional dan masa berlakunya.';
CREATE INDEX ix_certifications_expiring ON employee_certifications(organization_id,expires_at,employee_id) WHERE expires_at IS NOT NULL;

CREATE TABLE employee_documents (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- ID dokumen pegawai.
  organization_id bigint NOT NULL REFERENCES organizations(id), -- Batas organisasi.
  employee_id bigint NOT NULL, -- Pegawai pemilik dokumen.
  document_type varchar(50) NOT NULL, -- Jenis KTP, KK, kontrak, sertifikat, dan lain-lain.
  file_id bigint NOT NULL, -- Metadata file privat.
  issued_at date, -- Tanggal dokumen diterbitkan.
  expires_at date, -- Tanggal kedaluwarsa.
  verified_at timestamptz, -- Waktu verifikasi HRD.
  verified_by_user_id bigint REFERENCES users(id), -- HRD pemeriksa.
  created_at timestamptz NOT NULL DEFAULT now(), -- Waktu unggah.
  CONSTRAINT uq_employee_documents_org_id UNIQUE (organization_id,id),
  CONSTRAINT fk_documents_employee FOREIGN KEY (organization_id,employee_id) REFERENCES employees(organization_id,id) ON DELETE CASCADE,
  CONSTRAINT fk_documents_file FOREIGN KEY (organization_id,file_id) REFERENCES stored_files(organization_id,id)
);
COMMENT ON TABLE employee_documents IS 'Relasi dokumen privat dengan pegawai.';
CREATE INDEX ix_documents_employee_type ON employee_documents(organization_id,employee_id,document_type,expires_at);

CREATE TABLE employee_import_batches (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id bigint NOT NULL REFERENCES organizations(id),
  source_file_id bigint NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded','validating','validated','committing','partially_committed','committed','failed','cancelled')),
  total_rows integer NOT NULL DEFAULT 0 CHECK (total_rows >= 0),
  valid_rows integer NOT NULL DEFAULT 0 CHECK (valid_rows >= 0),
  invalid_rows integer NOT NULL DEFAULT 0 CHECK (invalid_rows >= 0),
  total_employees integer NOT NULL DEFAULT 0 CHECK (total_employees >= 0),
  valid_employees integer NOT NULL DEFAULT 0 CHECK (valid_employees >= 0),
  invalid_employees integer NOT NULL DEFAULT 0 CHECK (invalid_employees >= 0),
  committed_employees integer NOT NULL DEFAULT 0 CHECK (committed_employees >= 0),
  created_by_user_id bigint NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  validated_at timestamptz,
  committed_at timestamptz,
  error_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT uq_employee_import_batches_org_id UNIQUE (organization_id,id),
  CONSTRAINT fk_employee_import_source FOREIGN KEY (organization_id,source_file_id) REFERENCES stored_files(organization_id,id)
);

CREATE TABLE employee_import_rows (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id bigint NOT NULL REFERENCES organizations(id),
  batch_id bigint NOT NULL,
  row_number integer NOT NULL CHECK (row_number > 0),
  sheet_name varchar(40) NOT NULL DEFAULT 'Pegawai',
  entity_type varchar(40) NOT NULL DEFAULT 'employee',
  entity_ref varchar(100),
  employee_no varchar(60),
  raw_data jsonb NOT NULL,
  normalized_data jsonb,
  validation_errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','valid','invalid','committed','skipped')),
  employee_id bigint,
  CONSTRAINT uq_employee_import_row UNIQUE (batch_id,sheet_name,row_number),
  CONSTRAINT fk_employee_import_row_batch FOREIGN KEY (organization_id,batch_id) REFERENCES employee_import_batches(organization_id,id) ON DELETE CASCADE,
  CONSTRAINT fk_employee_import_row_employee FOREIGN KEY (organization_id,employee_id) REFERENCES employees(organization_id,id)
);
CREATE INDEX ix_employee_import_batches_status ON employee_import_batches(organization_id,status,created_at DESC);
CREATE INDEX ix_employee_import_rows_status ON employee_import_rows(organization_id,batch_id,status,row_number);
CREATE INDEX ix_employee_import_rows_employee ON employee_import_rows(organization_id,batch_id,employee_no,status,sheet_name,row_number);

CREATE TABLE employment_types (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- ID jenis hubungan kerja.
  organization_id bigint NOT NULL REFERENCES organizations(id), -- Organisasi; memungkinkan istilah berbeda per organisasi.
  code varchar(30) NOT NULL, -- Kode PKWTT/PKWT/PHL/THL/dll.
  name varchar(100) NOT NULL, -- Nama tampilan.
  requires_end_date boolean NOT NULL DEFAULT false, -- Kontrak wajib punya akhir atau tidak.
  is_active boolean NOT NULL DEFAULT true, -- Status master.
  created_at timestamptz NOT NULL DEFAULT now(), -- Waktu dibuat.
  updated_at timestamptz NOT NULL DEFAULT now(), -- Waktu diubah.
  CONSTRAINT uq_employment_types_code UNIQUE (organization_id,code),
  CONSTRAINT uq_employment_types_org_id UNIQUE (organization_id,id)
);
COMMENT ON TABLE employment_types IS 'Jenis hubungan kerja dibuat per organisasi agar fleksibel.';

CREATE TABLE employment_contracts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- ID periode kontrak.
  organization_id bigint NOT NULL REFERENCES organizations(id), -- Batas organisasi.
  employee_id bigint NOT NULL, -- Pegawai terkait.
  employment_type_id bigint NOT NULL, -- Jenis hubungan kerja.
  contract_no varchar(100), -- Nomor kontrak.
  start_date date NOT NULL, -- Tanggal mulai kontrak.
  end_date date, -- Tanggal akhir kontrak.
  status varchar(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','expired','terminated','renewed','cancelled')), -- Status periode kontrak; cancelled mempertahankan salah input sebagai histori audit.
  document_file_id bigint, -- Dokumen kontrak privat.
  notes text, -- Catatan HRD.
  created_at timestamptz NOT NULL DEFAULT now(), -- Waktu dicatat.
  updated_at timestamptz NOT NULL DEFAULT now(), -- Versi optimistik untuk koreksi kontrak.
  cancelled_at timestamptz, -- Waktu kontrak dibatalkan karena salah input.
  cancellation_reason text, -- Alasan pembatalan yang wajib diaudit.
  cancelled_by_user_id bigint REFERENCES users(id), -- Admin/HRD atau Superadmin pembatal.
  CONSTRAINT uq_contracts_org_id UNIQUE (organization_id,id),
  CONSTRAINT fk_contract_employee FOREIGN KEY (organization_id,employee_id) REFERENCES employees(organization_id,id),
  CONSTRAINT fk_contract_type FOREIGN KEY (organization_id,employment_type_id) REFERENCES employment_types(organization_id,id),
  CONSTRAINT fk_contract_file FOREIGN KEY (organization_id,document_file_id) REFERENCES stored_files(organization_id,id),
  CONSTRAINT ck_contract_dates CHECK (end_date IS NULL OR end_date >= start_date),
  CONSTRAINT ck_contract_cancellation CHECK (
    status <> 'cancelled'
    OR (cancelled_at IS NOT NULL AND cancellation_reason IS NOT NULL AND cancelled_by_user_id IS NOT NULL)
  )
);
COMMENT ON TABLE employment_contracts IS 'Seluruh histori kontrak; perpanjangan membuat baris baru dan tidak menimpa kontrak lama.';
CREATE INDEX ix_contracts_expiring ON employment_contracts(organization_id,end_date,employee_id) WHERE status = 'active' AND end_date IS NOT NULL;
CREATE INDEX ix_contracts_employee ON employment_contracts(organization_id,employee_id,start_date DESC);
CREATE TRIGGER trg_employment_contracts_updated_at BEFORE UPDATE ON employment_contracts FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE employee_onboarding_drafts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- ID draft form tambah pegawai.
  organization_id bigint NOT NULL REFERENCES organizations(id), -- Batas organisasi.
  created_by_user_id bigint NOT NULL REFERENCES users(id), -- HRD/Superadmin pemilik draft.
  status varchar(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','finalizing','completed','discarded','expired')), -- Lifecycle draft.
  current_step smallint NOT NULL DEFAULT 0 CONSTRAINT ck_employee_onboarding_draft_current_step CHECK (current_step BETWEEN 0 AND 3), -- Step wizard terakhir (Profil, Pendidikan, Kontrak, Penempatan).
  payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload)='object'), -- Nilai form sementara privat.
  version integer NOT NULL DEFAULT 1 CHECK (version > 0), -- Optimistic concurrency penyimpanan draft.
  submitted_employee_id bigint, -- Pegawai hasil finalisasi untuk idempotensi.
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'), -- Batas retensi draft.
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_employee_onboarding_drafts_org_id UNIQUE (organization_id,id),
  CONSTRAINT fk_employee_onboarding_draft_employee FOREIGN KEY (organization_id,submitted_employee_id) REFERENCES employees(organization_id,id)
);
CREATE UNIQUE INDEX uq_active_employee_onboarding_draft ON employee_onboarding_drafts(organization_id,created_by_user_id) WHERE status IN ('active','finalizing');
CREATE INDEX ix_employee_onboarding_drafts_expiry ON employee_onboarding_drafts(status,expires_at) WHERE status='active';
CREATE TRIGGER trg_employee_onboarding_drafts_updated_at BEFORE UPDATE ON employee_onboarding_drafts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
ALTER TABLE stored_files ADD CONSTRAINT fk_stored_file_onboarding_draft FOREIGN KEY (organization_id,onboarding_draft_id) REFERENCES employee_onboarding_drafts(organization_id,id);
CREATE INDEX ix_stored_files_onboarding_draft ON stored_files(organization_id,onboarding_draft_id,category,created_at DESC) WHERE onboarding_draft_id IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX uq_draft_current_document ON stored_files(onboarding_draft_id,category) WHERE onboarding_draft_id IS NOT NULL AND deleted_at IS NULL AND category IN ('contract','assignment_decree');

CREATE TABLE employee_assignments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- ID periode penempatan/rolling.
  organization_id bigint NOT NULL REFERENCES organizations(id), -- Batas organisasi.
  employee_id bigint NOT NULL, -- Pegawai yang ditempatkan.
  location_id bigint NOT NULL, -- Cabang/lokasi pada periode ini.
  organization_unit_id bigint NOT NULL, -- Divisi/unit pada periode ini.
  position_id bigint, -- Jabatan pada periode ini.
  supervisor_employee_id bigint, -- Atasan langsung pada periode ini.
  assignment_type varchar(25) NOT NULL DEFAULT 'primary' CHECK (assignment_type IN ('primary','acting','temporary','additional')), -- Jenis penugasan.
  change_type varchar(25) NOT NULL DEFAULT 'initial' CHECK (change_type IN ('initial','rotation','transfer','promotion','demotion','acting','correction')), -- Alasan klasifikasi perubahan.
  effective_from date NOT NULL, -- Tanggal awal inklusif.
  effective_until date, -- Tanggal akhir inklusif; NULL berarti aktif.
  decree_no varchar(100), -- Nomor SK/surat penempatan.
  document_file_id bigint, -- Dokumen pendukung.
  notes text, -- Alasan/catatan rolling.
  created_by_user_id bigint REFERENCES users(id), -- HRD pencatat.
  created_at timestamptz NOT NULL DEFAULT now(), -- Waktu record dibuat.
  updated_at timestamptz NOT NULL DEFAULT now(), -- Versi optimistik untuk koreksi penempatan.
  CONSTRAINT uq_assignments_org_id UNIQUE (organization_id,id),
  CONSTRAINT fk_assignment_employee FOREIGN KEY (organization_id,employee_id) REFERENCES employees(organization_id,id),
  CONSTRAINT fk_assignment_location FOREIGN KEY (organization_id,location_id) REFERENCES locations(organization_id,id),
  CONSTRAINT fk_assignment_unit FOREIGN KEY (organization_id,organization_unit_id) REFERENCES organization_units(organization_id,id),
  CONSTRAINT fk_assignment_position FOREIGN KEY (organization_id,position_id) REFERENCES positions(organization_id,id),
  CONSTRAINT fk_assignment_supervisor FOREIGN KEY (organization_id,supervisor_employee_id) REFERENCES employees(organization_id,id),
  CONSTRAINT fk_assignment_file FOREIGN KEY (organization_id,document_file_id) REFERENCES stored_files(organization_id,id),
  CONSTRAINT ck_assignment_dates CHECK (effective_until IS NULL OR effective_until >= effective_from)
);
COMMENT ON TABLE employee_assignments IS 'Sumber histori lokasi, divisi, jabatan, atasan, mutasi, dan rolling pegawai.';
-- Satu pegawai hanya boleh mempunyai satu penempatan utama yang masih aktif.
CREATE UNIQUE INDEX uq_current_primary_assignment ON employee_assignments(employee_id)
WHERE effective_until IS NULL AND assignment_type='primary';
CREATE INDEX ix_assignments_employee_history ON employee_assignments(organization_id,employee_id,effective_from DESC);
CREATE INDEX ix_assignments_current_location ON employee_assignments(organization_id,location_id,employee_id) WHERE effective_until IS NULL AND assignment_type='primary';
CREATE INDEX ix_assignments_current_unit ON employee_assignments(organization_id,organization_unit_id,employee_id) WHERE effective_until IS NULL AND assignment_type='primary';
CREATE TRIGGER trg_employee_assignments_updated_at BEFORE UPDATE ON employee_assignments FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- 4. SHIFT FLEKSIBEL DAN JADWAL HARIAN
-- ============================================================================

CREATE TABLE work_shifts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- ID master shift.
  organization_id bigint NOT NULL REFERENCES organizations(id), -- Organisasi pemilik shift.
  code varchar(30) NOT NULL, -- Kode shift unik.
  name varchar(100) NOT NULL, -- Nama shift.
  shift_type varchar(20) NOT NULL CHECK (shift_type IN ('fixed','flexible','field','off')), -- Fixed punya jam pasti; flexible/field dinilai berdasar durasi/kebijakan.
  start_time time, -- Jam mulai target untuk fixed.
  end_time time, -- Jam selesai target untuk fixed.
  check_in_window_start time, -- Batas awal clock-in yang diterima.
  check_in_window_end time, -- Batas akhir clock-in yang diterima.
  required_work_minutes integer NOT NULL DEFAULT 0 CHECK (required_work_minutes >= 0), -- Durasi kerja wajib untuk flexible/field.
  break_minutes integer NOT NULL DEFAULT 0 CHECK (break_minutes >= 0), -- Durasi istirahat standar.
  crosses_midnight boolean NOT NULL DEFAULT false, -- Shift berakhir pada hari berikutnya.
  late_tolerance_minutes integer NOT NULL DEFAULT 0 CHECK (late_tolerance_minutes >= 0), -- Toleransi sebelum ditandai terlambat.
  early_leave_tolerance_minutes integer NOT NULL DEFAULT 0 CHECK (early_leave_tolerance_minutes >= 0), -- Toleransi pulang awal.
  overtime_threshold_minutes integer NOT NULL DEFAULT 0 CHECK (overtime_threshold_minutes >= 0), -- Minimal lewat jadwal sebelum jadi kandidat lembur.
  overtime_policy varchar(20) NOT NULL DEFAULT 'approval_required' CHECK (overtime_policy IN ('disabled','automatic','approval_required')), -- Pulang telat tidak selalu otomatis lembur.
  is_active boolean NOT NULL DEFAULT true, -- Status master shift.
  created_at timestamptz NOT NULL DEFAULT now(), -- Waktu dibuat.
  updated_at timestamptz NOT NULL DEFAULT now(), -- Waktu diubah.
  CONSTRAINT uq_work_shifts_code UNIQUE (organization_id,code),
  CONSTRAINT uq_work_shifts_org_id UNIQUE (organization_id,id),
  CONSTRAINT ck_fixed_shift_times CHECK (shift_type <> 'fixed' OR (start_time IS NOT NULL AND end_time IS NOT NULL))
);
COMMENT ON TABLE work_shifts IS 'Master shift tetap, fleksibel, lapangan, dan hari libur beserta toleransi.';

CREATE TABLE shift_patterns (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- ID pola mingguan/rotasi.
  organization_id bigint NOT NULL REFERENCES organizations(id), -- Organisasi pemilik pola.
  code varchar(30) NOT NULL, -- Kode pola.
  name varchar(100) NOT NULL, -- Nama pola.
  cycle_days smallint NOT NULL DEFAULT 7 CHECK (cycle_days BETWEEN 1 AND 366), -- Panjang siklus pola.
  is_active boolean NOT NULL DEFAULT true, -- Status pola.
  CONSTRAINT uq_shift_patterns_code UNIQUE (organization_id,code),
  CONSTRAINT uq_shift_patterns_org_id UNIQUE (organization_id,id)
);
COMMENT ON TABLE shift_patterns IS 'Pola jadwal; mendukung Senin-Jumat maupun roster bergilir.';

CREATE TABLE shift_pattern_days (
  organization_id bigint NOT NULL REFERENCES organizations(id), -- Batas organisasi.
  shift_pattern_id bigint NOT NULL, -- Pola induk.
  day_no smallint NOT NULL CHECK (day_no BETWEEN 1 AND 366), -- Urutan hari dalam siklus.
  shift_id bigint NOT NULL, -- Shift pada hari tersebut, termasuk shift off.
  PRIMARY KEY (shift_pattern_id,day_no),
  CONSTRAINT fk_pattern_days_pattern FOREIGN KEY (organization_id,shift_pattern_id) REFERENCES shift_patterns(organization_id,id),
  CONSTRAINT fk_pattern_days_shift FOREIGN KEY (organization_id,shift_id) REFERENCES work_shifts(organization_id,id)
);
COMMENT ON TABLE shift_pattern_days IS 'Isi setiap hari pada pola shift.';

CREATE TABLE shift_assignments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- ID aturan penetapan pola.
  organization_id bigint NOT NULL REFERENCES organizations(id), -- Batas organisasi.
  employee_id bigint, -- Target pegawai; prioritas tertinggi.
  organization_unit_id bigint, -- Target divisi/unit; prioritas kedua.
  location_id bigint, -- Target cabang/lokasi; prioritas ketiga.
  shift_pattern_id bigint NOT NULL, -- Pola yang diberlakukan.
  effective_from date NOT NULL, -- Awal berlaku.
  effective_until date, -- Akhir berlaku.
  priority smallint NOT NULL DEFAULT 100, -- Nilai lebih kecil dipilih lebih dahulu dalam target setara.
  created_by_user_id bigint REFERENCES users(id), -- HRD pembuat aturan.
  created_at timestamptz NOT NULL DEFAULT now(), -- Waktu dibuat.
  CONSTRAINT uq_shift_assignments_org_id UNIQUE (organization_id,id),
  CONSTRAINT fk_shift_assignment_employee FOREIGN KEY (organization_id,employee_id) REFERENCES employees(organization_id,id),
  CONSTRAINT fk_shift_assignment_unit FOREIGN KEY (organization_id,organization_unit_id) REFERENCES organization_units(organization_id,id),
  CONSTRAINT fk_shift_assignment_location FOREIGN KEY (organization_id,location_id) REFERENCES locations(organization_id,id),
  CONSTRAINT fk_shift_assignment_pattern FOREIGN KEY (organization_id,shift_pattern_id) REFERENCES shift_patterns(organization_id,id),
  CONSTRAINT ck_shift_assignment_one_target CHECK (num_nonnulls(employee_id,organization_unit_id,location_id) = 1),
  CONSTRAINT ck_shift_assignment_dates CHECK (effective_until IS NULL OR effective_until >= effective_from)
);
COMMENT ON TABLE shift_assignments IS 'Aturan pola shift untuk pegawai, divisi, atau cabang. Resolusi: pegawai > divisi > lokasi.';
CREATE INDEX ix_shift_assign_employee ON shift_assignments(organization_id,employee_id,effective_from,effective_until) WHERE employee_id IS NOT NULL;
CREATE INDEX ix_shift_assign_unit ON shift_assignments(organization_id,organization_unit_id,effective_from,effective_until) WHERE organization_unit_id IS NOT NULL;
CREATE INDEX ix_shift_assign_location ON shift_assignments(organization_id,location_id,effective_from,effective_until) WHERE location_id IS NOT NULL;

CREATE TABLE employee_daily_schedules (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- ID jadwal harian hasil resolusi.
  organization_id bigint NOT NULL REFERENCES organizations(id), -- Batas organisasi.
  employee_id bigint NOT NULL, -- Pegawai terjadwal.
  work_date date NOT NULL, -- Tanggal kerja lokal.
  shift_id bigint NOT NULL, -- Shift yang berlaku.
  location_id bigint, -- Lokasi kerja untuk hari itu.
  source_assignment_id bigint, -- Aturan asal jadwal.
  scheduled_start_at timestamptz, -- Waktu mulai absolut snapshot.
  scheduled_end_at timestamptz, -- Waktu selesai absolut snapshot.
  status varchar(20) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','off','holiday','cancelled')), -- Status jadwal.
  is_override boolean NOT NULL DEFAULT false, -- Jadwal diubah manual dari pola.
  override_reason text, -- Alasan perubahan manual.
  generated_at timestamptz NOT NULL DEFAULT now(), -- Waktu jadwal dibentuk.
  CONSTRAINT uq_daily_schedule UNIQUE (organization_id,employee_id,work_date),
  CONSTRAINT uq_daily_schedule_org_id UNIQUE (organization_id,id),
  CONSTRAINT fk_daily_schedule_employee FOREIGN KEY (organization_id,employee_id) REFERENCES employees(organization_id,id),
  CONSTRAINT fk_daily_schedule_shift FOREIGN KEY (organization_id,shift_id) REFERENCES work_shifts(organization_id,id),
  CONSTRAINT fk_daily_schedule_location FOREIGN KEY (organization_id,location_id) REFERENCES locations(organization_id,id),
  CONSTRAINT fk_daily_schedule_source FOREIGN KEY (organization_id,source_assignment_id) REFERENCES shift_assignments(organization_id,id),
  CONSTRAINT ck_daily_schedule_times CHECK (scheduled_end_at IS NULL OR scheduled_start_at IS NULL OR scheduled_end_at > scheduled_start_at)
);
COMMENT ON TABLE employee_daily_schedules IS 'Snapshot jadwal per hari; menjaga perhitungan historis walau master shift berubah.';
CREATE INDEX ix_daily_schedule_org_date ON employee_daily_schedules(organization_id,work_date,status,employee_id);
CREATE INDEX ix_daily_schedule_employee ON employee_daily_schedules(organization_id,employee_id,work_date DESC);

-- ============================================================================
-- 5. TITIK ABSENSI, FOTO, GEOFENCE, IMPORT, DAN EVENT MOBILE
-- ============================================================================

CREATE TABLE attendance_points (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- ID titik/geofence absensi.
  organization_id bigint NOT NULL REFERENCES organizations(id), -- Organisasi pemilik titik.
  location_id bigint, -- Lokasi administratif terkait.
  code varchar(40) NOT NULL, -- Kode titik unik.
  name varchar(150) NOT NULL, -- Nama titik absensi.
  latitude numeric(10,7) NOT NULL CHECK (latitude BETWEEN -90 AND 90), -- Latitude pusat geofence.
  longitude numeric(10,7) NOT NULL CHECK (longitude BETWEEN -180 AND 180), -- Longitude pusat geofence.
  radius_m integer NOT NULL CHECK (radius_m BETWEEN 5 AND 50000), -- Toleransi jarak dalam meter.
  max_accuracy_m integer CHECK (max_accuracy_m > 0), -- Akurasi GPS terburuk yang masih diterima.
  requires_photo boolean NOT NULL DEFAULT true, -- Foto wajib saat absensi.
  requires_liveness boolean NOT NULL DEFAULT false, -- Flag kebutuhan liveness di aplikasi masa depan.
  requires_background_match boolean NOT NULL DEFAULT false, -- Flag validasi latar/referensi lokasi.
  reference_background_file_id bigint, -- Gambar referensi background bila digunakan.
  is_active boolean NOT NULL DEFAULT true, -- Status titik.
  active_from date NOT NULL DEFAULT current_date, -- Awal titik berlaku.
  active_until date, -- Akhir titik berlaku.
  created_at timestamptz NOT NULL DEFAULT now(), -- Waktu dibuat.
  updated_at timestamptz NOT NULL DEFAULT now(), -- Waktu diubah.
  CONSTRAINT uq_attendance_points_code UNIQUE (organization_id,code),
  CONSTRAINT uq_attendance_points_org_id UNIQUE (organization_id,id),
  CONSTRAINT fk_attendance_point_location FOREIGN KEY (organization_id,location_id) REFERENCES locations(organization_id,id),
  CONSTRAINT fk_attendance_point_reference FOREIGN KEY (organization_id,reference_background_file_id) REFERENCES stored_files(organization_id,id),
  CONSTRAINT ck_attendance_point_dates CHECK (active_until IS NULL OR active_until >= active_from)
);
COMMENT ON TABLE attendance_points IS 'Titik geofence yang dapat dipindah/diubah tanpa mengubah histori event lama.';

CREATE TABLE attendance_point_assignments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- ID aturan akses titik.
  organization_id bigint NOT NULL REFERENCES organizations(id), -- Batas organisasi.
  attendance_point_id bigint NOT NULL, -- Titik yang boleh digunakan.
  employee_id bigint, -- Target pegawai; prioritas tertinggi.
  organization_unit_id bigint, -- Target divisi/unit.
  location_id bigint, -- Target cabang/lokasi.
  effective_from date NOT NULL, -- Awal berlaku.
  effective_until date, -- Akhir berlaku.
  created_by_user_id bigint REFERENCES users(id), -- Superadmin/HRD pembuat aturan.
  created_at timestamptz NOT NULL DEFAULT now(), -- Waktu dibuat.
  CONSTRAINT fk_point_assignment_point FOREIGN KEY (organization_id,attendance_point_id) REFERENCES attendance_points(organization_id,id),
  CONSTRAINT fk_point_assignment_employee FOREIGN KEY (organization_id,employee_id) REFERENCES employees(organization_id,id),
  CONSTRAINT fk_point_assignment_unit FOREIGN KEY (organization_id,organization_unit_id) REFERENCES organization_units(organization_id,id),
  CONSTRAINT fk_point_assignment_location FOREIGN KEY (organization_id,location_id) REFERENCES locations(organization_id,id),
  CONSTRAINT ck_point_assignment_one_target CHECK (num_nonnulls(employee_id,organization_unit_id,location_id) = 1),
  CONSTRAINT ck_point_assignment_dates CHECK (effective_until IS NULL OR effective_until >= effective_from)
);
COMMENT ON TABLE attendance_point_assignments IS 'Aturan titik absensi per pegawai, divisi, atau cabang dengan periode berlaku.';
CREATE INDEX ix_point_assign_employee ON attendance_point_assignments(organization_id,employee_id,effective_from,effective_until) WHERE employee_id IS NOT NULL;
CREATE INDEX ix_point_assign_unit ON attendance_point_assignments(organization_id,organization_unit_id,effective_from,effective_until) WHERE organization_unit_id IS NOT NULL;
CREATE INDEX ix_point_assign_location ON attendance_point_assignments(organization_id,location_id,effective_from,effective_until) WHERE location_id IS NOT NULL;

CREATE TABLE attendance_devices (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- ID sumber/perangkat absensi.
  organization_id bigint NOT NULL REFERENCES organizations(id), -- Organisasi pemilik perangkat.
  device_code varchar(80) NOT NULL, -- Kode unik perangkat/instalasi.
  name varchar(150), -- Nama ramah perangkat.
  device_type varchar(30) NOT NULL CHECK (device_type IN ('mobile','web_kiosk','fingerprint','face_terminal','import','api')), -- Jenis sumber.
  location_id bigint, -- Lokasi tetap bila perangkat dipasang permanen.
  api_key_hash text, -- Hash kredensial perangkat; bukan API key asli.
  is_active boolean NOT NULL DEFAULT true, -- Status perangkat.
  last_seen_at timestamptz, -- Waktu terakhir berkomunikasi.
  CONSTRAINT uq_attendance_devices_code UNIQUE (organization_id,device_code),
  CONSTRAINT uq_attendance_devices_org_id UNIQUE (organization_id,id),
  CONSTRAINT fk_attendance_device_location FOREIGN KEY (organization_id,location_id) REFERENCES locations(organization_id,id)
);
COMMENT ON TABLE attendance_devices IS 'Registry sumber absensi web, mobile, mesin, import, dan API.';

CREATE TABLE attendance_import_batches (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- ID proses import massal.
  organization_id bigint NOT NULL REFERENCES organizations(id), -- Organisasi tujuan import.
  source_file_id bigint NOT NULL, -- File Excel/CSV privat.
  status varchar(20) NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded','validating','invalid','ready','committed','failed')), -- Tahap import.
  total_rows integer NOT NULL DEFAULT 0 CHECK (total_rows >= 0), -- Jumlah baris sumber.
  valid_rows integer NOT NULL DEFAULT 0 CHECK (valid_rows >= 0), -- Jumlah baris valid.
  invalid_rows integer NOT NULL DEFAULT 0 CHECK (invalid_rows >= 0), -- Jumlah baris bermasalah.
  uploaded_by_user_id bigint NOT NULL REFERENCES users(id), -- HRD pengunggah.
  created_at timestamptz NOT NULL DEFAULT now(), -- Waktu import dimulai.
  committed_at timestamptz, -- Waktu seluruh baris valid dimasukkan.
  error_summary jsonb NOT NULL DEFAULT '{}'::jsonb, -- Ringkasan error tanpa data sensitif berlebih.
  CONSTRAINT uq_import_batches_org_id UNIQUE (organization_id,id),
  CONSTRAINT fk_import_batch_file FOREIGN KEY (organization_id,source_file_id) REFERENCES stored_files(organization_id,id)
);
COMMENT ON TABLE attendance_import_batches IS 'Header import Excel/CSV agar HRD tidak menginput absensi satu per satu.';
CREATE INDEX ix_import_batches_status ON attendance_import_batches(organization_id,status,created_at DESC);

CREATE TABLE attendance_import_rows (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- ID baris staging.
  organization_id bigint NOT NULL REFERENCES organizations(id), -- Batas organisasi.
  batch_id bigint NOT NULL, -- Batch sumber.
  row_no integer NOT NULL CHECK (row_no > 0), -- Nomor baris Excel/CSV.
  employee_no varchar(60), -- NIP dari file sebelum resolusi.
  employee_id bigint, -- Pegawai hasil pencocokan.
  occurred_at timestamptz, -- Waktu absensi hasil parsing.
  event_type varchar(20), -- check_in/check_out hasil parsing.
  raw_data jsonb NOT NULL DEFAULT '{}'::jsonb, -- Data staging untuk preview, bukan sumber kebenaran setelah commit.
  validation_status varchar(20) NOT NULL DEFAULT 'pending' CHECK (validation_status IN ('pending','valid','invalid','committed')), -- Hasil validasi.
  validation_errors jsonb NOT NULL DEFAULT '[]'::jsonb, -- Daftar pesan validasi per baris.
  CONSTRAINT uq_import_row UNIQUE (batch_id,row_no),
  CONSTRAINT fk_import_row_batch FOREIGN KEY (organization_id,batch_id) REFERENCES attendance_import_batches(organization_id,id) ON DELETE CASCADE,
  CONSTRAINT fk_import_row_employee FOREIGN KEY (organization_id,employee_id) REFERENCES employees(organization_id,id)
);
COMMENT ON TABLE attendance_import_rows IS 'Staging import yang mendukung preview, koreksi, validasi, lalu commit transaksi.';
CREATE INDEX ix_import_rows_validation ON attendance_import_rows(batch_id,validation_status,row_no);

CREATE TABLE attendance_event_receipts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- ID penerimaan idempotensi.
  organization_id bigint NOT NULL REFERENCES organizations(id), -- Organisasi pengirim.
  client_event_id uuid NOT NULL, -- UUID dari aplikasi mobile/web, tetap sama saat retry.
  employee_id bigint NOT NULL, -- Pegawai pengirim.
  event_date date NOT NULL, -- Tanggal partisi event berdasarkan occurred_at.
  received_at timestamptz NOT NULL DEFAULT now(), -- Waktu pertama diterima server.
  processing_status varchar(20) NOT NULL DEFAULT 'received' CHECK (processing_status IN ('received','stored','rejected')), -- Status pemrosesan.
  rejection_code varchar(50), -- Kode penolakan stabil untuk klien.
  CONSTRAINT uq_event_receipt UNIQUE (organization_id,client_event_id),
  CONSTRAINT uq_event_receipts_org_id UNIQUE (organization_id,id),
  CONSTRAINT fk_event_receipt_employee FOREIGN KEY (organization_id,employee_id) REFERENCES employees(organization_id,id)
);
COMMENT ON TABLE attendance_event_receipts IS 'Kunci idempotensi global; retry mobile tidak menggandakan event walau tabel event dipartisi.';
CREATE INDEX ix_event_receipts_employee ON attendance_event_receipts(organization_id,employee_id,received_at DESC);

CREATE TABLE attendance_events (
  id bigint GENERATED ALWAYS AS IDENTITY, -- ID event dalam partisi.
  event_date date NOT NULL, -- Kunci partisi; harus sama dengan tanggal lokal occurred_at.
  organization_id bigint NOT NULL REFERENCES organizations(id), -- Batas organisasi.
  employee_id bigint NOT NULL, -- Pegawai pemilik event.
  receipt_id bigint, -- Receipt idempotensi untuk mobile/web; NULL untuk import lama.
  daily_schedule_id bigint, -- Jadwal snapshot yang dibandingkan.
  attendance_point_id bigint, -- Titik yang divalidasi saat kejadian.
  device_id bigint, -- Sumber/perangkat.
  event_type varchar(20) NOT NULL CHECK (event_type IN ('check_in','check_out','break_start','break_end')), -- Jenis kejadian.
  occurred_at timestamptz NOT NULL, -- Waktu kejadian menurut perangkat setelah validasi.
  received_at timestamptz NOT NULL DEFAULT now(), -- Waktu server menerima event.
  source varchar(20) NOT NULL CHECK (source IN ('mobile','web_kiosk','device','import','api','manual')), -- Kanal input.
  latitude numeric(10,7) CHECK (latitude BETWEEN -90 AND 90), -- Koordinat saat capture.
  longitude numeric(10,7) CHECK (longitude BETWEEN -180 AND 180), -- Koordinat saat capture.
  accuracy_m numeric(9,2) CHECK (accuracy_m IS NULL OR accuracy_m >= 0), -- Akurasi GPS dari perangkat.
  distance_from_point_m numeric(10,2) CHECK (distance_from_point_m IS NULL OR distance_from_point_m >= 0), -- Jarak hasil hitung backend.
  allowed_radius_m integer, -- Snapshot radius saat event agar histori tidak berubah.
  photo_file_id bigint, -- Foto capture privat.
  validation_status varchar(20) NOT NULL DEFAULT 'pending' CHECK (validation_status IN ('pending','valid','invalid','needs_review')), -- Hasil validasi keseluruhan.
  geofence_status varchar(20) CHECK (geofence_status IN ('inside','outside','unavailable','not_required')), -- Hasil geofence.
  photo_status varchar(20) CHECK (photo_status IN ('valid','invalid','unavailable','not_required','needs_review')), -- Hasil foto/liveness/background.
  validation_details jsonb NOT NULL DEFAULT '{}'::jsonb, -- Alasan dan skor provider yang tidak menjadi kolom inti.
  is_offline_capture boolean NOT NULL DEFAULT false, -- Event dibuat offline lalu disinkronkan.
  captured_timezone varchar(50), -- Zona waktu perangkat saat capture untuk audit.
  created_by_user_id bigint REFERENCES users(id), -- User untuk input manual/koreksi.
  created_at timestamptz NOT NULL DEFAULT now(), -- Waktu record disimpan.
  PRIMARY KEY (event_date,id),
  CONSTRAINT fk_attendance_event_employee FOREIGN KEY (organization_id,employee_id) REFERENCES employees(organization_id,id),
  CONSTRAINT fk_attendance_event_receipt FOREIGN KEY (organization_id,receipt_id) REFERENCES attendance_event_receipts(organization_id,id),
  CONSTRAINT fk_attendance_event_schedule FOREIGN KEY (organization_id,daily_schedule_id) REFERENCES employee_daily_schedules(organization_id,id),
  CONSTRAINT fk_attendance_event_point FOREIGN KEY (organization_id,attendance_point_id) REFERENCES attendance_points(organization_id,id),
  CONSTRAINT fk_attendance_event_device FOREIGN KEY (organization_id,device_id) REFERENCES attendance_devices(organization_id,id),
  CONSTRAINT fk_attendance_event_photo FOREIGN KEY (organization_id,photo_file_id) REFERENCES stored_files(organization_id,id)
) PARTITION BY RANGE (event_date);
COMMENT ON TABLE attendance_events IS 'Event absensi mentah append-only, siap mobile dan dipartisi bulanan berdasarkan event_date.';

-- Default partition mencegah insert gagal bila partisi bulanan belum dibuat.
CREATE TABLE attendance_events_default PARTITION OF attendance_events DEFAULT;

-- Index partitioned otomatis dibuat pada setiap partisi saat ini dan mendatang.
CREATE INDEX ix_attendance_events_employee_time ON attendance_events(organization_id,employee_id,occurred_at DESC);
CREATE INDEX ix_attendance_events_org_date ON attendance_events(organization_id,event_date,event_type);
CREATE INDEX ix_attendance_events_review ON attendance_events(organization_id,event_date,validation_status) WHERE validation_status IN ('invalid','needs_review');
CREATE INDEX ix_attendance_events_receipt ON attendance_events(receipt_id) WHERE receipt_id IS NOT NULL;

-- Membuat partisi bulanan. Jalankan scheduler sebelum bulan baru.
CREATE OR REPLACE FUNCTION ensure_attendance_month_partition(month_start date)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  partition_start date := date_trunc('month',month_start)::date;
  partition_end date := (date_trunc('month',month_start) + interval '1 month')::date;
  partition_name text := format('attendance_events_%s',to_char(partition_start,'YYYY_MM'));
BEGIN
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS %I PARTITION OF attendance_events FOR VALUES FROM (%L) TO (%L)',
    partition_name,partition_start,partition_end
  );
END;
$$;

CREATE TABLE attendance_daily_summaries (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- ID rekap harian.
  organization_id bigint NOT NULL REFERENCES organizations(id), -- Batas organisasi.
  employee_id bigint NOT NULL, -- Pegawai yang direkap.
  work_date date NOT NULL, -- Tanggal kerja lokal.
  daily_schedule_id bigint, -- Jadwal yang menjadi dasar penilaian.
  first_check_in timestamptz, -- Clock-in valid pertama.
  last_check_out timestamptz, -- Clock-out valid terakhir.
  worked_minutes integer NOT NULL DEFAULT 0 CHECK (worked_minutes >= 0), -- Durasi kerja bersih.
  late_minutes integer NOT NULL DEFAULT 0 CHECK (late_minutes >= 0), -- Menit terlambat setelah toleransi.
  early_leave_minutes integer NOT NULL DEFAULT 0 CHECK (early_leave_minutes >= 0), -- Menit pulang awal setelah toleransi.
  overtime_candidate_minutes integer NOT NULL DEFAULT 0 CHECK (overtime_candidate_minutes >= 0), -- Kandidat lembur dari jam aktual.
  approved_overtime_minutes integer NOT NULL DEFAULT 0 CHECK (approved_overtime_minutes >= 0), -- Lembur yang disetujui HRD.
  attendance_status varchar(25) NOT NULL CHECK (attendance_status IN ('present','late','absent','leave','permission','sick','official_duty','off','holiday','incomplete','needs_review')), -- Status utama dashboard.
  calculation_version varchar(30) NOT NULL DEFAULT 'v1', -- Versi aturan agar rekap dapat dihitung ulang.
  is_manual_override boolean NOT NULL DEFAULT false, -- Penanda koreksi HRD.
  override_reason text, -- Alasan koreksi.
  calculated_at timestamptz NOT NULL DEFAULT now(), -- Waktu kalkulasi terakhir.
  calculated_by_user_id bigint REFERENCES users(id), -- User bila rekap dikoreksi manual.
  CONSTRAINT uq_daily_summary UNIQUE (organization_id,employee_id,work_date),
  CONSTRAINT fk_summary_employee FOREIGN KEY (organization_id,employee_id) REFERENCES employees(organization_id,id),
  CONSTRAINT fk_summary_schedule FOREIGN KEY (organization_id,daily_schedule_id) REFERENCES employee_daily_schedules(organization_id,id)
);
COMMENT ON TABLE attendance_daily_summaries IS 'Rekap cepat untuk dashboard. Dapat dihitung ulang dari jadwal, event, cuti, dan koreksi.';
CREATE INDEX ix_summary_dashboard_status ON attendance_daily_summaries(organization_id,work_date,attendance_status,employee_id);
CREATE INDEX ix_summary_employee_history ON attendance_daily_summaries(organization_id,employee_id,work_date DESC);
CREATE INDEX ix_summary_late_rank ON attendance_daily_summaries(organization_id,work_date,late_minutes DESC) WHERE late_minutes > 0;
CREATE INDEX ix_summary_absence ON attendance_daily_summaries(organization_id,employee_id,work_date DESC) WHERE attendance_status='absent';

-- ============================================================================
-- 6. CUTI DAN IZIN - KEPUTUSAN HANYA OLEH HRD
-- ============================================================================

CREATE TABLE leave_types (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- ID jenis cuti/izin.
  organization_id bigint NOT NULL REFERENCES organizations(id), -- Organisasi pemilik aturan.
  code varchar(30) NOT NULL, -- Kode unik jenis.
  name varchar(100) NOT NULL, -- Nama jenis.
  category varchar(20) NOT NULL CHECK (category IN ('leave','permission','sick','official_duty','other')), -- Kelompok rekap.
  unit varchar(10) NOT NULL DEFAULT 'day' CHECK (unit IN ('day','hour')), -- Satuan saldo/durasi.
  requires_attachment boolean NOT NULL DEFAULT false, -- Lampiran wajib atau tidak.
  required_attachment_category varchar(40), -- Contoh medical_letter untuk izin sakit.
  uses_balance boolean NOT NULL DEFAULT true, -- Mengurangi saldo atau tidak.
  annual_allowance integer, -- Hak tahunan default dalam bilangan bulat.
  is_active boolean NOT NULL DEFAULT true, -- Status master.
  created_at timestamptz NOT NULL DEFAULT now(), -- Waktu master dibuat.
  updated_at timestamptz NOT NULL DEFAULT now(), -- Versi optimistic concurrency.
  CONSTRAINT uq_leave_types_code UNIQUE (organization_id,code),
  CONSTRAINT uq_leave_types_org_id UNIQUE (organization_id,id),
  CONSTRAINT ck_leave_types_allowance CHECK (annual_allowance IS NULL OR annual_allowance >= 0),
  CONSTRAINT ck_leave_types_attachment CHECK (NOT requires_attachment OR required_attachment_category IS NOT NULL)
);
COMMENT ON TABLE leave_types IS 'Master cuti/izin. Izin sakit dapat mewajibkan surat dokter.';

CREATE TABLE leave_requests (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- ID pengajuan/catatan izin.
  organization_id bigint NOT NULL REFERENCES organizations(id), -- Batas organisasi.
  request_no varchar(60) NOT NULL, -- Nomor pengajuan unik.
  employee_id bigint NOT NULL, -- Pegawai pemohon.
  leave_type_id bigint NOT NULL, -- Jenis cuti/izin.
  start_at timestamptz NOT NULL, -- Awal izin.
  end_at timestamptz NOT NULL, -- Akhir izin.
  requested_units integer NOT NULL CHECK (requested_units > 0), -- Durasi hari/jam dalam bilangan bulat.
  reason text, -- Alasan pengajuan.
  submission_source varchar(20) NOT NULL DEFAULT 'hrd_entry' CHECK (submission_source IN ('hrd_entry','employee_web','employee_mobile','import','api')), -- Kanal input sekarang dan masa depan.
  status varchar(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','rejected','cancelled')), -- Status proses.
  submitted_at timestamptz, -- Waktu diajukan.
  created_by_user_id bigint NOT NULL REFERENCES users(id), -- HRD saat ini atau pegawai kelak.
  cancelled_at timestamptz, -- Waktu pembatalan logis.
  cancelled_by_user_id bigint REFERENCES users(id), -- HRD pembatal.
  cancellation_reason text, -- Alasan pembatalan wajib dan diaudit.
  created_at timestamptz NOT NULL DEFAULT now(), -- Waktu record dibuat.
  updated_at timestamptz NOT NULL DEFAULT now(), -- Waktu record diubah.
  CONSTRAINT uq_leave_request_no UNIQUE (organization_id,request_no),
  CONSTRAINT uq_leave_requests_org_id UNIQUE (organization_id,id),
  CONSTRAINT fk_leave_employee FOREIGN KEY (organization_id,employee_id) REFERENCES employees(organization_id,id),
  CONSTRAINT fk_leave_type FOREIGN KEY (organization_id,leave_type_id) REFERENCES leave_types(organization_id,id),
  CONSTRAINT ck_leave_dates CHECK (end_at >= start_at),
  CONSTRAINT ck_leave_requests_cancellation CHECK (
    (status<>'cancelled' AND cancelled_at IS NULL AND cancelled_by_user_id IS NULL AND cancellation_reason IS NULL)
    OR (status='cancelled' AND cancelled_at IS NOT NULL AND cancelled_by_user_id IS NOT NULL AND char_length(btrim(cancellation_reason))>=10)
  )
);
COMMENT ON TABLE leave_requests IS 'Pengajuan atau input HRD atas cuti/izin; pimpinan tidak menjadi approver.';
CREATE INDEX ix_leave_pending ON leave_requests(organization_id,status,submitted_at) WHERE status='submitted';
CREATE INDEX ix_leave_employee_history ON leave_requests(organization_id,employee_id,start_at DESC);

CREATE TABLE leave_request_attachments (
  organization_id bigint NOT NULL REFERENCES organizations(id), -- Batas organisasi.
  leave_request_id bigint NOT NULL, -- Pengajuan terkait.
  file_id bigint NOT NULL, -- Surat dokter/foto/dokumen privat.
  attachment_category varchar(40) NOT NULL, -- Jenis lampiran.
  uploaded_at timestamptz NOT NULL DEFAULT now(), -- Waktu unggah.
  PRIMARY KEY (leave_request_id,file_id),
  CONSTRAINT fk_leave_attachment_request FOREIGN KEY (organization_id,leave_request_id) REFERENCES leave_requests(organization_id,id) ON DELETE CASCADE,
  CONSTRAINT fk_leave_attachment_file FOREIGN KEY (organization_id,file_id) REFERENCES stored_files(organization_id,id)
);
COMMENT ON TABLE leave_request_attachments IS 'Lampiran izin, termasuk surat dokter yang tersimpan privat.';

CREATE TABLE leave_decisions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- ID keputusan.
  organization_id bigint NOT NULL REFERENCES organizations(id), -- Batas organisasi.
  leave_request_id bigint NOT NULL UNIQUE, -- Pengajuan yang diputus.
  decision varchar(20) NOT NULL CHECK (decision IN ('approved','rejected')), -- Hasil keputusan HRD.
  decided_by_user_id bigint NOT NULL REFERENCES users(id), -- User HRD pengambil keputusan.
  decision_role varchar(20) NOT NULL DEFAULT 'hrd' CONSTRAINT ck_leave_decisions_role CHECK (decision_role IN ('hrd','superadmin')), -- Guard bahwa approver hanya HRD atau Superadmin berizin.
  notes text, -- Catatan keputusan.
  decided_at timestamptz NOT NULL DEFAULT now(), -- Waktu keputusan.
  CONSTRAINT fk_leave_decision_request FOREIGN KEY (organization_id,leave_request_id) REFERENCES leave_requests(organization_id,id) ON DELETE CASCADE
);
COMMENT ON TABLE leave_decisions IS 'Satu keputusan final oleh HRD; permission backend wajib memverifikasi role aktif.';

CREATE TABLE leave_entitlements (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id bigint NOT NULL REFERENCES organizations(id),
  employee_id bigint NOT NULL,
  leave_type_id bigint NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  created_by_user_id bigint NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_leave_entitlements_org_id UNIQUE (organization_id,id),
  CONSTRAINT uq_leave_entitlement_period UNIQUE (organization_id,employee_id,leave_type_id,period_start),
  CONSTRAINT fk_leave_entitlement_employee FOREIGN KEY (organization_id,employee_id) REFERENCES employees(organization_id,id),
  CONSTRAINT fk_leave_entitlement_type FOREIGN KEY (organization_id,leave_type_id) REFERENCES leave_types(organization_id,id),
  CONSTRAINT ck_leave_entitlement_period CHECK (period_end>=period_start)
);
COMMENT ON TABLE leave_entitlements IS 'Periode hak saldo cuti pegawai; nilai saldo berasal dari penjumlahan ledger.';

CREATE TABLE leave_balance_transactions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id bigint NOT NULL REFERENCES organizations(id),
  entitlement_id bigint NOT NULL,
  leave_request_id bigint,
  transaction_type varchar(20) NOT NULL CHECK (transaction_type IN ('grant','carryover','adjustment','usage','restoration')),
  units integer NOT NULL CHECK (units<>0),
  reason text NOT NULL CHECK (char_length(btrim(reason))>=5),
  created_by_user_id bigint NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_leave_balance_transactions_org_id UNIQUE (organization_id,id),
  CONSTRAINT fk_leave_balance_entitlement FOREIGN KEY (organization_id,entitlement_id) REFERENCES leave_entitlements(organization_id,id),
  CONSTRAINT fk_leave_balance_request FOREIGN KEY (organization_id,leave_request_id) REFERENCES leave_requests(organization_id,id),
  CONSTRAINT ck_leave_balance_direction CHECK ((transaction_type IN ('grant','carryover','restoration') AND units>0) OR transaction_type='adjustment' OR (transaction_type='usage' AND units<0))
);
COMMENT ON TABLE leave_balance_transactions IS 'Ledger saldo cuti append-only untuk grant, koreksi, pemakaian, dan pengembalian.';
CREATE UNIQUE INDEX uq_leave_balance_request_usage ON leave_balance_transactions(organization_id,leave_request_id,transaction_type) WHERE leave_request_id IS NOT NULL AND transaction_type IN ('usage','restoration');
CREATE INDEX ix_leave_entitlements_employee ON leave_entitlements(organization_id,employee_id,period_start DESC);
CREATE INDEX ix_leave_balance_entitlement ON leave_balance_transactions(organization_id,entitlement_id,created_at,id);
CREATE INDEX ix_leave_requests_period ON leave_requests(organization_id,start_at,end_at,status);

-- ============================================================================
-- 7. PELANGGARAN, INDIKATOR, KASUS, DAN SANKSI RESMI
-- ============================================================================

CREATE TABLE discipline_rules (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- ID aturan indikator.
  organization_id bigint NOT NULL REFERENCES organizations(id), -- Organisasi pemilik aturan.
  code varchar(50) NOT NULL, -- Kode aturan stabil.
  name varchar(200) NOT NULL, -- Nama indikator/pelanggaran.
  severity varchar(15) NOT NULL CHECK (severity IN ('light','moderate','severe')), -- Ringan/sedang/berat sesuai peraturan.
  metric_type varchar(40) NOT NULL CHECK (metric_type IN ('absence_consecutive','absence_monthly','late_count','early_leave_count','missing_punch','manual')), -- Sumber indikator.
  threshold_value integer CHECK (threshold_value > 0), -- Ambang angka bila dapat dihitung.
  window_days integer CHECK (window_days > 0), -- Jendela evaluasi bila diperlukan.
  legal_reference varchar(100), -- Referensi pasal/ayat.
  recommended_action varchar(30), -- Rekomendasi nonmengikat; bukan keputusan otomatis.
  is_active boolean NOT NULL DEFAULT true, -- Status aturan.
  CONSTRAINT uq_discipline_rule_code UNIQUE (organization_id,code),
  CONSTRAINT uq_discipline_rule_org_id UNIQUE (organization_id,id)
);
COMMENT ON TABLE discipline_rules IS 'Aturan pembentuk indikator. Sistem tidak otomatis menjatuhkan sanksi.';

CREATE TABLE discipline_indicators (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- ID sinyal dashboard.
  organization_id bigint NOT NULL REFERENCES organizations(id), -- Batas organisasi.
  employee_id bigint NOT NULL, -- Pegawai yang terindikasi.
  rule_id bigint NOT NULL, -- Aturan pemicu.
  period_start date NOT NULL, -- Awal periode perhitungan.
  period_end date NOT NULL, -- Akhir periode perhitungan.
  measured_value numeric(12,2), -- Nilai aktual, misalnya jumlah hari mangkir.
  status varchar(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewed','dismissed','converted_to_case')), -- Status tinjauan HRD.
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb, -- Referensi tanggal/rekap pendukung.
  generated_at timestamptz NOT NULL DEFAULT now(), -- Waktu indikator dibuat.
  reviewed_by_user_id bigint REFERENCES users(id), -- HRD pemeriksa.
  reviewed_at timestamptz, -- Waktu pemeriksaan.
  CONSTRAINT uq_discipline_indicators_org_id UNIQUE (organization_id,id),
  CONSTRAINT fk_indicator_employee FOREIGN KEY (organization_id,employee_id) REFERENCES employees(organization_id,id),
  CONSTRAINT fk_indicator_rule FOREIGN KEY (organization_id,rule_id) REFERENCES discipline_rules(organization_id,id),
  CONSTRAINT ck_indicator_dates CHECK (period_end >= period_start)
);
COMMENT ON TABLE discipline_indicators IS 'Daftar siapa sering absen/terlambat untuk ditinjau HRD; bukan sanksi.';
CREATE INDEX ix_indicators_dashboard ON discipline_indicators(organization_id,status,generated_at DESC,employee_id);

CREATE TABLE discipline_cases (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- ID pemeriksaan kasus.
  organization_id bigint NOT NULL REFERENCES organizations(id), -- Batas organisasi.
  case_no varchar(60) NOT NULL, -- Nomor kasus unik.
  employee_id bigint NOT NULL, -- Pegawai terperiksa.
  indicator_id bigint, -- Indikator asal bila ada.
  severity varchar(15) NOT NULL CHECK (severity IN ('light','moderate','severe')), -- Klasifikasi hasil HRD.
  incident_date date NOT NULL, -- Tanggal kejadian utama.
  description text NOT NULL, -- Uraian pelanggaran.
  employee_explanation text, -- Penjelasan/pembelaan pegawai.
  status varchar(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open','investigating','closed_no_action','action_issued')), -- Tahap pemeriksaan.
  opened_by_user_id bigint NOT NULL REFERENCES users(id), -- HRD pembuka kasus.
  opened_at timestamptz NOT NULL DEFAULT now(), -- Waktu kasus dibuka.
  closed_at timestamptz, -- Waktu kasus selesai.
  CONSTRAINT uq_discipline_case_no UNIQUE (organization_id,case_no),
  CONSTRAINT uq_discipline_cases_org_id UNIQUE (organization_id,id),
  CONSTRAINT fk_case_indicator FOREIGN KEY (organization_id,indicator_id) REFERENCES discipline_indicators(organization_id,id),
  CONSTRAINT fk_case_employee FOREIGN KEY (organization_id,employee_id) REFERENCES employees(organization_id,id)
);
COMMENT ON TABLE discipline_cases IS 'Pemeriksaan HRD yang memisahkan indikator otomatis dari keputusan manusia.';
CREATE INDEX ix_cases_employee_history ON discipline_cases(organization_id,employee_id,incident_date DESC);
CREATE INDEX ix_cases_open ON discipline_cases(organization_id,status,opened_at DESC) WHERE status IN ('open','investigating');

CREATE TABLE disciplinary_actions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- ID tindakan/sanksi resmi.
  organization_id bigint NOT NULL REFERENCES organizations(id), -- Batas organisasi.
  discipline_case_id bigint NOT NULL, -- Kasus yang mendasari tindakan.
  employee_id bigint NOT NULL, -- Pegawai penerima tindakan untuk query histori cepat.
  action_type varchar(30) NOT NULL CHECK (action_type IN ('oral_warning','sp1','sp2','sp3','suspension','salary_delay','promotion_delay','demotion','fine','termination','other')), -- Jenis tindakan sesuai Pasal 55-58.
  letter_no varchar(100), -- Nomor surat; NULL hanya dapat diterima untuk teguran lisan.
  issued_date date NOT NULL, -- Tanggal diterbitkan.
  effective_from date NOT NULL, -- Awal berlaku.
  effective_until date, -- Akhir berlaku; SP1-SP3 harus 3 bulan sesuai peraturan.
  status varchar(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','expired','revoked','appealed')), -- Status tindakan.
  direct_escalation boolean NOT NULL DEFAULT false, -- SP2/SP3 langsung pada kasus sedang/berat.
  escalation_reason text, -- Alasan wajib untuk lompatan tahapan.
  document_file_id bigint, -- Surat resmi privat; wajib oleh aplikasi untuk tindakan tertulis.
  issued_by_user_id bigint NOT NULL REFERENCES users(id), -- HRD pencatat/penerbit di sistem.
  notes text, -- Catatan internal berizin.
  revoked_at timestamptz, -- Waktu tindakan aktif dicabut secara logis.
  revoked_by_user_id bigint REFERENCES users(id), -- HRD/Superadmin pencabut tindakan.
  revocation_reason text, -- Alasan wajib yang dipertahankan dalam histori.
  created_at timestamptz NOT NULL DEFAULT now(), -- Waktu dicatat.
  CONSTRAINT uq_disciplinary_action_case UNIQUE (organization_id,discipline_case_id), -- Satu tindakan resmi per kasus.
  CONSTRAINT fk_action_case FOREIGN KEY (organization_id,discipline_case_id) REFERENCES discipline_cases(organization_id,id),
  CONSTRAINT fk_action_employee FOREIGN KEY (organization_id,employee_id) REFERENCES employees(organization_id,id),
  CONSTRAINT fk_action_document FOREIGN KEY (organization_id,document_file_id) REFERENCES stored_files(organization_id,id),
  CONSTRAINT ck_action_dates CHECK (effective_until IS NULL OR effective_until >= effective_from),
  CONSTRAINT ck_action_letter CHECK (action_type='oral_warning' OR status='draft' OR (letter_no IS NOT NULL AND document_file_id IS NOT NULL)),
  CONSTRAINT ck_action_escalation CHECK (NOT direct_escalation OR escalation_reason IS NOT NULL),
  CONSTRAINT ck_disciplinary_action_revocation CHECK (
    (status='revoked' AND revoked_at IS NOT NULL AND revoked_by_user_id IS NOT NULL AND length(btrim(revocation_reason)) >= 10)
    OR (status<>'revoked' AND revoked_at IS NULL AND revoked_by_user_id IS NULL AND revocation_reason IS NULL)
  ),
  CONSTRAINT ck_sp_validity CHECK (action_type NOT IN ('sp1','sp2','sp3') OR effective_until = (issued_date + interval '3 months')::date)
);
COMMENT ON TABLE disciplinary_actions IS 'Tindakan resmi HRD. SP1/SP2/SP3 berlaku tepat 3 bulan; histori tidak ditimpa.';
CREATE INDEX ix_actions_employee_history ON disciplinary_actions(organization_id,employee_id,issued_date DESC);
CREATE INDEX ix_actions_active ON disciplinary_actions(organization_id,status,effective_until,employee_id) WHERE status='active';

-- Seed aturan berdasarkan Pasal 56-58. Rekomendasi tetap harus ditinjau HRD.
INSERT INTO discipline_rules(organization_id,code,name,severity,metric_type,threshold_value,window_days,legal_reference,recommended_action)
SELECT id,'ABSENT_1_DAY','Mangkir 1 hari kerja','light','absence_consecutive',1,31,'Pasal 56 ayat (2) huruf a','oral_warning' FROM organizations;
INSERT INTO discipline_rules(organization_id,code,name,severity,metric_type,threshold_value,window_days,legal_reference,recommended_action)
SELECT id,'ABSENT_3_CONSECUTIVE','Mangkir 3 hari kerja berturut-turut','moderate','absence_consecutive',3,31,'Pasal 57 ayat (2) huruf a','sp1' FROM organizations;
INSERT INTO discipline_rules(organization_id,code,name,severity,metric_type,threshold_value,window_days,legal_reference,recommended_action)
SELECT id,'ABSENT_5_CONSECUTIVE','Mangkir 5 hari kerja berturut-turut atau lebih','severe','absence_consecutive',5,31,'Pasal 58 ayat (2) huruf a','sp3' FROM organizations;
INSERT INTO discipline_rules(organization_id,code,name,severity,metric_type,threshold_value,window_days,legal_reference,recommended_action)
SELECT id,'ABSENT_9_MONTHLY','Mangkir 9 hari kerja dalam 1 bulan','severe','absence_monthly',9,31,'Pasal 58 ayat (2) huruf b','sp3' FROM organizations;

-- ============================================================================
-- 8. AUDIT, OUTBOX, VIEW DASHBOARD, DAN TRIGGER
-- ============================================================================

CREATE TABLE audit_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- ID audit immutable.
  organization_id bigint REFERENCES organizations(id), -- Organisasi; NULL untuk aksi platform.
  actor_user_id bigint REFERENCES users(id), -- Pelaku tindakan.
  action varchar(60) NOT NULL, -- Kode aksi create/update/approve/export/login/dll.
  entity_type varchar(80) NOT NULL, -- Nama entitas.
  entity_id text NOT NULL, -- ID entitas dalam bentuk teks.
  before_data jsonb, -- Snapshot sebelum dengan data sensitif yang sudah disaring.
  after_data jsonb, -- Snapshot sesudah dengan data sensitif yang sudah disaring.
  ip_address inet, -- IP sumber.
  user_agent text, -- Perangkat/browser sumber.
  request_id uuid, -- Korelasi log API.
  occurred_at timestamptz NOT NULL DEFAULT now() -- Waktu aksi.
);
COMMENT ON TABLE audit_logs IS 'Jejak audit append-only; aplikasi tidak menyediakan edit atau delete.';
CREATE INDEX ix_audit_tenant_time ON audit_logs(organization_id,occurred_at DESC);
CREATE INDEX ix_audit_entity ON audit_logs(organization_id,entity_type,entity_id,occurred_at DESC);
CREATE INDEX ix_audit_actor ON audit_logs(actor_user_id,occurred_at DESC);

CREATE TABLE integration_outbox (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- ID event integrasi.
  organization_id bigint REFERENCES organizations(id), -- Organisasi pemilik event.
  event_type varchar(100) NOT NULL, -- Nama event versi API.
  aggregate_type varchar(80) NOT NULL, -- Jenis entitas sumber.
  aggregate_id text NOT NULL, -- ID entitas sumber.
  payload jsonb NOT NULL, -- Payload minimal tanpa rahasia.
  occurred_at timestamptz NOT NULL DEFAULT now(), -- Waktu transaksi bisnis.
  published_at timestamptz, -- Waktu berhasil dikirim.
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0), -- Jumlah percobaan.
  next_attempt_at timestamptz NOT NULL DEFAULT now(), -- Jadwal retry.
  last_error text -- Error internal terakhir.
);
COMMENT ON TABLE integration_outbox IS 'Transactional outbox untuk sinkronisasi mobile, notifikasi, dan integrasi tanpa dual-write.';
CREATE INDEX ix_outbox_pending ON integration_outbox(next_attempt_at,id) WHERE published_at IS NULL;

-- Profil aktif untuk dashboard pimpinan/HRD tanpa menghitung histori berulang.
CREATE VIEW v_employee_current_profile AS
SELECT
  e.organization_id,
  e.id AS employee_id,
  e.employee_no,
  e.full_name,
  e.employment_status,
  e.joined_date,
  a.location_id,
  l.name AS location_name,
  a.organization_unit_id,
  ou.name AS organization_unit_name,
  a.position_id,
  p.name AS position_name,
  a.supervisor_employee_id,
  a.effective_from AS assignment_since
FROM employees e
LEFT JOIN employee_assignments a
  ON a.organization_id=e.organization_id
 AND a.employee_id=e.id
 AND a.assignment_type='primary'
 AND a.effective_until IS NULL
LEFT JOIN locations l ON l.organization_id=a.organization_id AND l.id=a.location_id
LEFT JOIN organization_units ou ON ou.organization_id=a.organization_id AND ou.id=a.organization_unit_id
LEFT JOIN positions p ON p.organization_id=a.organization_id AND p.id=a.position_id
WHERE e.deleted_at IS NULL;
COMMENT ON VIEW v_employee_current_profile IS 'Penempatan aktif pegawai untuk pencarian dashboard; histori tetap di employee_assignments.';

-- Ringkasan indikator pimpinan: hanya agregat dan status, bukan dokumen sensitif.
CREATE VIEW v_employee_attention_summary AS
SELECT
  e.organization_id,
  e.id AS employee_id,
  e.employee_no,
  e.full_name,
  count(*) FILTER (WHERE s.attendance_status='absent') AS absent_days,
  count(*) FILTER (WHERE s.late_minutes>0) AS late_days,
  COALESCE(sum(s.late_minutes),0) AS total_late_minutes,
  count(*) FILTER (WHERE s.attendance_status='needs_review') AS attendance_needs_review
FROM employees e
LEFT JOIN attendance_daily_summaries s
  ON s.organization_id=e.organization_id
 AND s.employee_id=e.id
 AND s.work_date >= current_date - 30
WHERE e.deleted_at IS NULL
GROUP BY e.organization_id,e.id,e.employee_no,e.full_name;
COMMENT ON VIEW v_employee_attention_summary IS 'Ringkasan 30 hari untuk dashboard pimpinan/HRD tanpa membuka bukti sensitif.';

CREATE VIEW v_user_identity AS
SELECT user_account.id AS user_id,user_account.username::text AS username,
  COALESCE(employee.full_name,platform_profile.full_name,'@' || user_account.username::text) AS display_name,
  CASE WHEN employee.id IS NOT NULL THEN 'employee' WHEN platform_profile.user_id IS NOT NULL THEN 'platform' ELSE 'username' END AS identity_source,
  COALESCE(contact.work_email,contact.personal_email,platform_profile.email)::text AS contact_email,
  COALESCE(contact.whatsapp,platform_profile.whatsapp) AS whatsapp,
  employee.id AS employee_id,employee.organization_id AS employee_organization_id,
  employee.preferred_name,contact.personal_email::text AS personal_email,contact.work_email::text AS work_email
FROM users user_account
LEFT JOIN employees employee ON employee.user_id=user_account.id AND employee.deleted_at IS NULL
LEFT JOIN employee_contacts contact ON contact.organization_id=employee.organization_id AND contact.employee_id=employee.id
LEFT JOIN platform_user_profiles platform_profile ON platform_profile.user_id=user_account.id;
COMMENT ON VIEW v_user_identity IS 'Identitas terpusat: profil pegawai, profil platform, lalu username.';
-- updated_at diterapkan hanya pada tabel yang memang dapat diedit.
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'organizations','organization_subscriptions','organization_branding','locations','organization_unit_types','organization_units','positions',
    'users','platform_user_profiles','employees','employee_contacts','employment_types','work_shifts','attendance_points','leave_types','leave_requests','leave_entitlements'
  ]
  LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      table_name,table_name
    );
  END LOOP;
END;
$$;

-- Role sistem. Permission detail sebaiknya di-seed melalui migration aplikasi.
INSERT INTO roles(code,name,scope,description,is_system) VALUES
  ('superadmin','Super Administrator','platform','Membuat organisasi, lokasi awal, dan akun admin.',true),
  ('leader','Pimpinan','organization','Memantau dashboard dan histori sesuai cakupan tanpa mengubah data HRD.',true),
  ('hrd','HRD','organization','Mengelola pegawai, absensi, izin, rolling, kontrak, dan tindakan disiplin.',true),
  ('employee','Pegawai','self','Mengakses data sendiri dan kanal self-service masa depan.',true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions(code,description) VALUES
  ('employees.read','Melihat daftar dan detail pegawai.'),
  ('employees.read_sensitive','Melihat data pribadi dan administrasi sensitif pegawai.'),
  ('employees.create','Membuat profil pegawai.'),
  ('employees.update','Memperbarui profil pegawai.'),
  ('employees.deactivate','Mengakhiri status aktif pegawai.'),
  ('assignments.read','Melihat histori penempatan pegawai.'),
  ('assignments.manage','Membuat penempatan awal, rolling, mutasi, promosi, dan demosi.'),
  ('contracts.read','Melihat kontrak kerja pegawai.'),
  ('contracts.manage','Membuat dan memperbarui siklus kontrak kerja.'),
  ('discipline.read','Melihat kasus dan histori sanksi.'),
  ('discipline.manage','Membuka kasus dan menerbitkan tindakan disiplin.'),
  ('accounts.read','Melihat akun organisasi.'),
  ('accounts.manage','Membuat, menautkan, dan mengubah akun organisasi.'),
  ('employee_import.read','Melihat batch dan pratinjau import pegawai.'),
  ('employee_import.manage','Mengunggah, memvalidasi, dan commit import pegawai.'),
  ('leave_types.read','Melihat master jenis cuti dan izin.'),
  ('leave_types.manage','Membuat dan mengubah master jenis cuti dan izin.'),
  ('leave_requests.read','Melihat pencatatan, saldo, dan histori cuti atau izin.'),
  ('leave_requests.manage','Mencatat dan membatalkan cuti atau izin.'),
  ('leave_balances.manage','Menyesuaikan saldo cuti pegawai.'),
  ('private_files.read','Melihat metadata file privat.'),
  ('private_files.read_sensitive','Melihat dan mengunduh file sensitif.'),
  ('private_files.manage','Mengunggah dan melakukan soft delete file privat.'),
  ('employees.read_self','Melihat profil pegawai milik akun sendiri.'),
  ('assignments.read_self','Melihat penempatan milik akun sendiri.'),
  ('contracts.read_self','Melihat kontrak milik akun sendiri.'),
  ('private_files.read_self','Melihat file privat milik akun sendiri.'),
  ('profile_self.read','Membaca profil akun sendiri.'),
  ('profile_self.update','Memperbarui kontak profil dan password akun sendiri.')
ON CONFLICT (code) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO role_permissions(role_id,permission_id)
SELECT role.id,permission.id FROM roles role CROSS JOIN permissions permission
WHERE role.code IN ('superadmin','hrd')
  AND permission.code IN (
    'employees.read','employees.read_sensitive','employees.create','employees.update','employees.deactivate',
    'assignments.read','assignments.manage','contracts.read','contracts.manage',
    'discipline.read','discipline.manage','accounts.read','accounts.manage',
    'employee_import.read','employee_import.manage',
    'leave_types.read','leave_types.manage','leave_requests.read','leave_requests.manage','leave_balances.manage',
    'private_files.read','private_files.read_sensitive','private_files.manage',
    'profile_self.read','profile_self.update'
  )
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions(role_id,permission_id)
SELECT role.id,permission.id FROM roles role CROSS JOIN permissions permission
WHERE role.code='leader'
  AND permission.code IN (
    'employees.read','employees.read_sensitive','assignments.read','contracts.read',
    'discipline.read','leave_types.read','leave_requests.read','private_files.read','private_files.read_sensitive',
    'profile_self.read','profile_self.update'
  )
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions(role_id,permission_id)
SELECT role.id,permission.id FROM roles role CROSS JOIN permissions permission
WHERE role.code='employee'
  AND permission.code IN (
    'employees.read_self','assignments.read_self','contracts.read_self','private_files.read_self',
    'profile_self.read','profile_self.update'
  )
ON CONFLICT DO NOTHING;

DO $$
DECLARE
  superadmin_permission_count integer;
  hrd_permission_count integer;
  leader_permission_count integer;
  employee_permission_count integer;
BEGIN
  SELECT COUNT(*) FILTER (WHERE role.code='superadmin'),
         COUNT(*) FILTER (WHERE role.code='hrd'),
         COUNT(*) FILTER (WHERE role.code='leader'),
         COUNT(*) FILTER (WHERE role.code='employee')
  INTO superadmin_permission_count,hrd_permission_count,
       leader_permission_count,employee_permission_count
  FROM role_permissions mapping
  JOIN roles role ON role.id=mapping.role_id
  JOIN permissions permission ON permission.id=mapping.permission_id
  WHERE permission.code IN (
    'employees.read','employees.read_sensitive','employees.create','employees.update','employees.deactivate',
    'assignments.read','assignments.manage','contracts.read','contracts.manage',
    'discipline.read','discipline.manage','accounts.read','accounts.manage',
    'employee_import.read','employee_import.manage',
    'leave_types.read','leave_types.manage','leave_requests.read','leave_requests.manage','leave_balances.manage',
    'private_files.read','private_files.read_sensitive','private_files.manage',
    'employees.read_self','assignments.read_self','contracts.read_self','private_files.read_self',
    'profile_self.read','profile_self.update'
  );

  IF superadmin_permission_count<>25 OR hrd_permission_count<>25
    OR leader_permission_count<>11 OR employee_permission_count<>6 THEN
    RAISE EXCEPTION
      'Seed permission tidak lengkap: superadmin %, hrd %, leader %, employee %',
      superadmin_permission_count,hrd_permission_count,
      leader_permission_count,employee_permission_count;
  END IF;
END;
$$;
COMMIT;

-- CATATAN DEPLOYMENT:
-- 1. Onboarding organisasi dilakukan dalam satu transaksi: buat organizations, branding,
--    periode pertama organization_subscriptions, role HRD, serta master awal organisasi.
-- 2. Seed discipline_rules di atas hanya berlaku untuk organisasi yang sudah ada
--    saat migration dijalankan; onboarding organisasi baru wajib membuat seed yang sama.
-- 3. Jalankan ensure_attendance_month_partition() untuk bulan berjalan dan 2 bulan
--    ke depan melalui migration/scheduler.
-- 4. Seluruh query organisasi wajib memuat organization_id walaupun sudah memakai FK.
-- 5. Query file tidak pernah mengembalikan object_key langsung ke klien; API membuat
--    respons stream atau URL singkat setelah pemeriksaan permission.
-- 6. Organisasi hanya boleh masuk jika organizations.is_active=true dan memiliki periode
--    organization_subscriptions berstatus active/grace pada tanggal berjalan.
-- 7. Perpanjangan langganan selalu INSERT record baru. Jangan mengubah ends_on periode
--    lama karena histori penggunaan dan perpanjangan harus tetap dapat diaudit.
-- 8. Service wajib mencegah dua periode active/grace untuk organisasi yang sama saling
--    bertumpang tindih dan memperbarui status berdasarkan tanggal melalui scheduled job.
