BEGIN;

-- Mode eksplisit mencegah membership tanpa scope lokasi dianggap full-access secara tidak sengaja.
ALTER TABLE user_organization_roles
  ADD COLUMN IF NOT EXISTS location_scope_mode varchar(20);

UPDATE user_organization_roles membership
SET location_scope_mode = CASE
  WHEN role.code IN ('superadmin','leader','employee') THEN 'all'
  WHEN role.code = 'hrd' AND EXISTS (
    SELECT 1 FROM user_location_scopes scope
    WHERE scope.user_organization_role_id=membership.id
  ) THEN 'selected'
  ELSE 'all'
END
FROM roles role
WHERE role.id=membership.role_id AND membership.location_scope_mode IS NULL;

ALTER TABLE user_organization_roles
  ALTER COLUMN location_scope_mode SET DEFAULT 'selected',
  ALTER COLUMN location_scope_mode SET NOT NULL;

ALTER TABLE user_organization_roles
  DROP CONSTRAINT IF EXISTS ck_user_org_role_location_scope_mode;
ALTER TABLE user_organization_roles
  ADD CONSTRAINT ck_user_org_role_location_scope_mode
  CHECK (location_scope_mode IN ('all','selected'));

-- Relasi langsung ke pegawai memungkinkan otorisasi file tanpa membaca atau menebak object_key.
ALTER TABLE stored_files
  ADD COLUMN IF NOT EXISTS employee_id bigint;
ALTER TABLE stored_files
  DROP CONSTRAINT IF EXISTS fk_stored_files_employee;
ALTER TABLE stored_files
  ADD CONSTRAINT fk_stored_files_employee
  FOREIGN KEY (organization_id,employee_id) REFERENCES employees(organization_id,id);
CREATE INDEX IF NOT EXISTS ix_stored_files_employee
  ON stored_files(organization_id,employee_id,created_at DESC)
  WHERE deleted_at IS NULL;

-- Batch import menyimpan preview dan hasil normalisasi sebelum commit ke tabel pegawai.
CREATE TABLE IF NOT EXISTS employee_import_batches (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id bigint NOT NULL REFERENCES organizations(id),
  source_file_id bigint NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'uploaded'
    CHECK (status IN ('uploaded','validating','validated','committing','committed','failed','cancelled')),
  total_rows integer NOT NULL DEFAULT 0 CHECK (total_rows >= 0),
  valid_rows integer NOT NULL DEFAULT 0 CHECK (valid_rows >= 0),
  invalid_rows integer NOT NULL DEFAULT 0 CHECK (invalid_rows >= 0),
  created_by_user_id bigint NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  validated_at timestamptz,
  committed_at timestamptz,
  error_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT uq_employee_import_batches_org_id UNIQUE (organization_id,id),
  CONSTRAINT fk_employee_import_source
    FOREIGN KEY (organization_id,source_file_id) REFERENCES stored_files(organization_id,id)
);

CREATE TABLE IF NOT EXISTS employee_import_rows (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id bigint NOT NULL REFERENCES organizations(id),
  batch_id bigint NOT NULL,
  row_number integer NOT NULL CHECK (row_number > 0),
  raw_data jsonb NOT NULL,
  normalized_data jsonb,
  validation_errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  status varchar(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','valid','invalid','committed','skipped')),
  employee_id bigint,
  CONSTRAINT uq_employee_import_row UNIQUE (batch_id,row_number),
  CONSTRAINT fk_employee_import_row_batch
    FOREIGN KEY (organization_id,batch_id)
    REFERENCES employee_import_batches(organization_id,id) ON DELETE CASCADE,
  CONSTRAINT fk_employee_import_row_employee
    FOREIGN KEY (organization_id,employee_id) REFERENCES employees(organization_id,id)
);

CREATE INDEX IF NOT EXISTS ix_employee_import_batches_status
  ON employee_import_batches(organization_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS ix_employee_import_rows_status
  ON employee_import_rows(organization_id,batch_id,status,row_number);

-- Permission stabil dipakai oleh route handler dan service, bukan hanya untuk menyembunyikan tombol.
INSERT INTO permissions(code,description) VALUES
  ('employees.read','Melihat daftar dan detail pegawai.'),
  ('employees.read_sensitive','Melihat data pribadi dan administrasi sensitif pegawai.'),
  ('employees.create','Membuat profil pegawai.'),
  ('employees.update','Memperbarui profil pegawai.'),
  ('employees.deactivate','Mengakhiri status aktif pegawai.'),
  ('assignments.read','Melihat histori penempatan pegawai.'),
  ('assignments.manage','Membuat penempatan awal, rolling, mutasi, promosi, dan demosi.'),
  ('contracts.read','Melihat kontrak kerja pegawai.'),
  ('contracts.manage','Membuat dan memperbarui lifecycle kontrak kerja.'),
  ('discipline.read','Melihat kasus dan histori sanksi.'),
  ('discipline.manage','Membuka kasus dan menerbitkan tindakan disiplin.'),
  ('accounts.read','Melihat akun organisasi.'),
  ('accounts.manage','Membuat, menautkan, dan mengubah akun organisasi.'),
  ('employee_import.read','Melihat batch dan preview import pegawai.'),
  ('employee_import.manage','Mengunggah, memvalidasi, dan commit import pegawai.'),
  ('private_files.read','Melihat metadata file privat.'),
  ('private_files.read_sensitive','Preview dan download file sensitif.'),
  ('private_files.manage','Mengunggah dan melakukan soft delete file privat.'),
  ('employees.read_self','Melihat profil pegawai milik akun sendiri.'),
  ('assignments.read_self','Melihat penempatan milik akun sendiri.'),
  ('contracts.read_self','Melihat kontrak milik akun sendiri.'),
  ('private_files.read_self','Melihat file privat milik akun sendiri.')
ON CONFLICT (code) DO UPDATE SET description=EXCLUDED.description;

INSERT INTO role_permissions(role_id,permission_id)
SELECT role.id,permission.id
FROM roles role CROSS JOIN permissions permission
WHERE role.code='superadmin'
  AND permission.code IN (
    'employees.read','employees.read_sensitive','employees.create','employees.update','employees.deactivate',
    'assignments.read','assignments.manage','contracts.read','contracts.manage',
    'discipline.read','discipline.manage','accounts.read','accounts.manage',
    'employee_import.read','employee_import.manage',
    'private_files.read','private_files.read_sensitive','private_files.manage'
  )
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions(role_id,permission_id)
SELECT role.id,permission.id
FROM roles role CROSS JOIN permissions permission
WHERE role.code='hrd'
  AND permission.code IN (
    'employees.read','employees.read_sensitive','employees.create','employees.update','employees.deactivate',
    'assignments.read','assignments.manage','contracts.read','contracts.manage',
    'discipline.read','discipline.manage','accounts.read','accounts.manage',
    'employee_import.read','employee_import.manage',
    'private_files.read','private_files.read_sensitive','private_files.manage'
  )
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions(role_id,permission_id)
SELECT role.id,permission.id
FROM roles role CROSS JOIN permissions permission
WHERE role.code='leader'
  AND permission.code IN (
    'employees.read','employees.read_sensitive','assignments.read','contracts.read',
    'discipline.read','private_files.read','private_files.read_sensitive'
  )
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions(role_id,permission_id)
SELECT role.id,permission.id
FROM roles role CROSS JOIN permissions permission
WHERE role.code='employee'
  AND permission.code IN (
    'employees.read_self','assignments.read_self','contracts.read_self','private_files.read_self'
  )
ON CONFLICT DO NOTHING;

-- Endpoint self-service belum tersedia; hapus grant generik lama agar akun Karyawan tidak dapat
-- membaca seluruh data organisasi melalui API administrasi yang sudah aktif.
DELETE FROM role_permissions mapping
USING roles role, permissions permission
WHERE mapping.role_id=role.id
  AND mapping.permission_id=permission.id
  AND role.code='employee'
  AND permission.code IN ('employees.read','assignments.read','contracts.read','private_files.read');

COMMIT;
