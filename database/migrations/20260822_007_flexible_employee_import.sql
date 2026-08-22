BEGIN;

-- Batch membedakan sumber data-only dan paket lengkap serta merangkum hasil per pegawai.
ALTER TABLE employee_import_batches
  ADD COLUMN IF NOT EXISTS source_kind varchar(10) NOT NULL DEFAULT 'xlsx',
  ADD COLUMN IF NOT EXISTS total_employees integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valid_employees integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS invalid_employees integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS committed_employees integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_documents integer NOT NULL DEFAULT 0;

ALTER TABLE employee_import_batches
  DROP CONSTRAINT IF EXISTS employee_import_batches_status_check,
  DROP CONSTRAINT IF EXISTS ck_employee_import_batches_source_kind,
  DROP CONSTRAINT IF EXISTS ck_employee_import_batches_counts;

ALTER TABLE employee_import_batches
  ADD CONSTRAINT employee_import_batches_status_check
    CHECK (status IN ('uploaded','validating','validated','committing','partially_committed','committed','failed','cancelled')),
  ADD CONSTRAINT ck_employee_import_batches_source_kind CHECK (source_kind IN ('xlsx','zip')),
  ADD CONSTRAINT ck_employee_import_batches_counts CHECK (
    total_employees >= 0 AND valid_employees >= 0 AND invalid_employees >= 0
    AND committed_employees >= 0 AND total_documents >= 0
  );

-- Nomor baris hanya unik di dalam sheet; entity_ref menghubungkan histori dan dokumen.
ALTER TABLE employee_import_rows
  ADD COLUMN IF NOT EXISTS sheet_name varchar(40) NOT NULL DEFAULT 'Pegawai',
  ADD COLUMN IF NOT EXISTS entity_type varchar(40) NOT NULL DEFAULT 'employee',
  ADD COLUMN IF NOT EXISTS entity_ref varchar(100),
  ADD COLUMN IF NOT EXISTS employee_no varchar(60);

ALTER TABLE employee_import_rows DROP CONSTRAINT IF EXISTS uq_employee_import_row;
ALTER TABLE employee_import_rows
  ADD CONSTRAINT uq_employee_import_row UNIQUE (batch_id,sheet_name,row_number);

CREATE INDEX IF NOT EXISTS ix_employee_import_rows_employee
  ON employee_import_rows(organization_id,batch_id,employee_no,status,sheet_name,row_number);

COMMIT;
