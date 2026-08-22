BEGIN;

-- Identitas administratif dapat memiliki label khusus dan file privat terkait.
ALTER TABLE employee_identifiers
  ADD COLUMN identifier_label varchar(100),
  ADD COLUMN document_file_id bigint;

ALTER TABLE employee_identifiers
  DROP CONSTRAINT employee_identifiers_identifier_type_check,
  ADD CONSTRAINT employee_identifiers_identifier_type_check
    CHECK (identifier_type IN ('bpjs_health','bpjs_employment','tax_npwp','family_card','passport','other')),
  ADD CONSTRAINT ck_employee_identifier_label
    CHECK (identifier_type <> 'other' OR identifier_label IS NOT NULL),
  ADD CONSTRAINT fk_employee_identifier_file
    FOREIGN KEY (organization_id,document_file_id) REFERENCES stored_files(organization_id,id);

CREATE INDEX ix_employee_identifiers_file
  ON employee_identifiers(organization_id,document_file_id)
  WHERE document_file_id IS NOT NULL;

COMMIT;
