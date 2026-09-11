-- Mempercepat filter daftar pegawai berdasarkan pencatat awal yang tersimpan append-only di audit_logs.
CREATE INDEX IF NOT EXISTS ix_audit_employee_create_lookup
  ON audit_logs(organization_id,entity_id,actor_user_id)
  WHERE entity_type='employee' AND action='employee.create';
