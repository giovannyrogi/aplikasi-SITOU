-- A relational snapshot keeps historical templates visible to storage retention.
ALTER TABLE leave_requests ADD COLUMN template_file_id bigint;
ALTER TABLE leave_requests ADD CONSTRAINT fk_leave_request_template
  FOREIGN KEY(organization_id,template_file_id) REFERENCES stored_files(organization_id,id);
UPDATE leave_requests SET template_file_id=(policy_snapshot->>'templateFileId')::bigint
  WHERE policy_snapshot->>'templateFileId' IS NOT NULL;
COMMENT ON COLUMN leave_requests.template_file_id IS 'Private template version retained for this request, independent from later master changes.';
