-- Reuse leave records/ledger. Only workflow metadata and durable mutation receipts are new.
ALTER TABLE leave_types
  ADD COLUMN template_file_id bigint,
  ADD COLUMN attachment_label varchar(100),
  ADD COLUMN document_instructions varchar(2000),
  ADD CONSTRAINT fk_leave_template FOREIGN KEY (organization_id,template_file_id)
    REFERENCES stored_files(organization_id,id);
ALTER TABLE leave_requests
  ADD COLUMN policy_snapshot jsonb,
  ADD COLUMN schedule_snapshot jsonb,
  ADD COLUMN review_notes text,
  ADD COLUMN reviewed_by_user_id bigint REFERENCES users(id),
  ADD COLUMN reviewed_at timestamptz;
ALTER TABLE leave_requests DROP CONSTRAINT leave_requests_status_check;
ALTER TABLE leave_requests ADD CONSTRAINT leave_requests_status_check
  CHECK(status IN ('draft','submitted','needs_revision','approved','rejected','cancelled'));
ALTER TABLE leave_request_attachments ADD COLUMN is_current boolean NOT NULL DEFAULT true;
CREATE INDEX ix_leave_current_documents ON leave_request_attachments(organization_id,leave_request_id) WHERE is_current;
CREATE TABLE leave_request_operations (
  organization_id bigint NOT NULL REFERENCES organizations(id),
  actor_user_id bigint NOT NULL REFERENCES users(id),
  request_key uuid NOT NULL,
  operation varchar(40) NOT NULL,
  payload_hash char(64) NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(organization_id,actor_user_id,request_key)
);
COMMENT ON COLUMN leave_requests.policy_snapshot IS 'Frozen leave type, balance rule, required document and private template at submission; NULL means legacy HRD entry.';
COMMENT ON COLUMN leave_requests.schedule_snapshot IS 'Resolved work dates/sessions and unit calculation at submission; legacy hourly records have no inferred clock times.';
COMMENT ON TABLE leave_request_operations IS 'Idempotency receipts for leave mutations; independent from attendance and work schedule receipts.';
CREATE INDEX ix_leave_active_reservations ON leave_requests(organization_id,employee_id,leave_type_id,start_at)
  WHERE status IN ('submitted','needs_revision');
INSERT INTO permissions(code,description) VALUES ('leave_requests.submit_self','Mengajukan dan melengkapi cuti/izin sendiri.') ON CONFLICT(code) DO NOTHING;
INSERT INTO role_permissions(role_id,permission_id)
  SELECT r.id,p.id FROM roles r CROSS JOIN permissions p
  WHERE r.code IN ('employee','hrd','leader') AND p.code='leave_requests.submit_self'
  ON CONFLICT DO NOTHING;
