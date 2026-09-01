BEGIN;

-- Status cuti lama adalah kondisi sementara, bukan status hubungan kerja.
INSERT INTO audit_logs (
  organization_id,actor_user_id,action,entity_type,entity_id,before_data,after_data,request_id
)
SELECT organization_id,NULL,'employee.leave_status_normalized','employee',id::text,
  jsonb_build_object('employment_status','leave'),
  jsonb_build_object('employment_status','active','source','migration_022'),
  gen_random_uuid()
FROM employees
WHERE employment_status='leave';

UPDATE employees SET employment_status='active' WHERE employment_status='leave';

DO $$
DECLARE constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid='employees'::regclass
    AND contype='c'
    AND pg_get_constraintdef(oid) ILIKE '%employment_status%';
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE employees DROP CONSTRAINT %I',constraint_name);
  END IF;
END $$;

ALTER TABLE employees
  ADD CONSTRAINT ck_employees_employment_status
  CHECK (employment_status IN ('draft','active','probation','suspended','terminated','retired','deceased'));

DO $$
DECLARE constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid='stored_files'::regclass
    AND contype='c'
    AND pg_get_constraintdef(oid) ILIKE '%category%';
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE stored_files DROP CONSTRAINT %I',constraint_name);
  END IF;
END $$;

ALTER TABLE stored_files
  ADD CONSTRAINT ck_stored_files_category
  CHECK (category IN ('logo','employee_photo','attendance_photo','medical_letter','leave_attachment','contract','assignment_decree','discipline_letter','identity','education','other'));

ALTER TABLE leave_types
  ADD COLUMN created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

UPDATE leave_types
SET required_attachment_category=CASE WHEN category='sick' THEN 'medical_letter' ELSE 'leave_attachment' END
WHERE requires_attachment AND required_attachment_category IS NULL;

ALTER TABLE leave_types
  ADD CONSTRAINT ck_leave_types_allowance
    CHECK (annual_allowance IS NULL OR annual_allowance >= 0),
  ADD CONSTRAINT ck_leave_types_attachment
    CHECK (NOT requires_attachment OR required_attachment_category IS NOT NULL);

CREATE TRIGGER trg_leave_types_updated_at
BEFORE UPDATE ON leave_types
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE leave_requests
  ADD COLUMN cancelled_at timestamptz,
  ADD COLUMN cancelled_by_user_id bigint REFERENCES users(id),
  ADD COLUMN cancellation_reason text;

UPDATE leave_requests
SET cancelled_at=COALESCE(updated_at,now()),
    cancelled_by_user_id=created_by_user_id,
    cancellation_reason='Pembatalan lama sebelum workflow cuti dan izin diterapkan.'
WHERE status='cancelled';

ALTER TABLE leave_requests
  ADD CONSTRAINT ck_leave_requests_cancellation CHECK (
    (status<>'cancelled' AND cancelled_at IS NULL AND cancelled_by_user_id IS NULL AND cancellation_reason IS NULL)
    OR
    (status='cancelled' AND cancelled_at IS NOT NULL AND cancelled_by_user_id IS NOT NULL AND char_length(btrim(cancellation_reason))>=10)
  );

ALTER TABLE leave_decisions DROP CONSTRAINT IF EXISTS leave_decisions_decision_role_check;
ALTER TABLE leave_decisions
  ADD CONSTRAINT ck_leave_decisions_role CHECK (decision_role IN ('hrd','superadmin'));

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

CREATE TRIGGER trg_leave_entitlements_updated_at
BEFORE UPDATE ON leave_entitlements
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE leave_balance_transactions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id bigint NOT NULL REFERENCES organizations(id),
  entitlement_id bigint NOT NULL,
  leave_request_id bigint,
  transaction_type varchar(20) NOT NULL CHECK (transaction_type IN ('grant','carryover','adjustment','usage','restoration')),
  units numeric(8,2) NOT NULL CHECK (units<>0),
  reason text NOT NULL CHECK (char_length(btrim(reason))>=5),
  created_by_user_id bigint NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_leave_balance_transactions_org_id UNIQUE (organization_id,id),
  CONSTRAINT fk_leave_balance_entitlement FOREIGN KEY (organization_id,entitlement_id) REFERENCES leave_entitlements(organization_id,id),
  CONSTRAINT fk_leave_balance_request FOREIGN KEY (organization_id,leave_request_id) REFERENCES leave_requests(organization_id,id),
  CONSTRAINT ck_leave_balance_direction CHECK (
    (transaction_type IN ('grant','carryover','restoration') AND units>0)
    OR transaction_type='adjustment'
    OR (transaction_type='usage' AND units<0)
  )
);

CREATE UNIQUE INDEX uq_leave_balance_request_usage
  ON leave_balance_transactions(organization_id,leave_request_id,transaction_type)
  WHERE leave_request_id IS NOT NULL AND transaction_type IN ('usage','restoration');
CREATE INDEX ix_leave_entitlements_employee
  ON leave_entitlements(organization_id,employee_id,period_start DESC);
CREATE INDEX ix_leave_balance_entitlement
  ON leave_balance_transactions(organization_id,entitlement_id,created_at,id);
CREATE INDEX ix_leave_requests_period
  ON leave_requests(organization_id,start_at,end_at,status);

INSERT INTO permissions(code,description) VALUES
  ('leave_types.read','Melihat master jenis cuti dan izin.'),
  ('leave_types.manage','Membuat dan mengubah master jenis cuti dan izin.'),
  ('leave_requests.read','Melihat pencatatan, saldo, dan histori cuti atau izin.'),
  ('leave_requests.manage','Mencatat dan membatalkan cuti atau izin.'),
  ('leave_balances.manage','Menyesuaikan saldo cuti pegawai.')
ON CONFLICT (code) DO UPDATE SET description=EXCLUDED.description;

INSERT INTO role_permissions(role_id,permission_id)
SELECT role.id,permission.id FROM roles role CROSS JOIN permissions permission
WHERE role.code IN ('superadmin','hrd')
  AND permission.code IN ('leave_types.read','leave_types.manage','leave_requests.read','leave_requests.manage','leave_balances.manage')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions(role_id,permission_id)
SELECT role.id,permission.id FROM roles role CROSS JOIN permissions permission
WHERE role.code='leader' AND permission.code IN ('leave_types.read','leave_requests.read')
ON CONFLICT DO NOTHING;

COMMENT ON TABLE leave_entitlements IS 'Periode hak saldo cuti pegawai; nilai saldo berasal dari penjumlahan ledger.';
COMMENT ON TABLE leave_balance_transactions IS 'Ledger saldo cuti append-only untuk grant, koreksi, pemakaian, dan pengembalian.';

COMMIT;
