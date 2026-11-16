-- Lindungi salinan referensi Excel dari perubahan master selama migrasi.
LOCK TABLE organization_unit_types, organization_units, positions, employment_types, inventory_categories, inventory_warehouses IN ACCESS EXCLUSIVE MODE;

CREATE TABLE employee_import_legacy_master_refs (
  organization_id bigint NOT NULL REFERENCES organizations(id),
  legacy_ref text NOT NULL,
  organization_unit_id bigint,
  position_id bigint,
  employment_type_id bigint,
  CHECK (num_nonnulls(organization_unit_id,position_id,employment_type_id)=1),
  FOREIGN KEY (organization_id,organization_unit_id) REFERENCES organization_units(organization_id,id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id,position_id) REFERENCES positions(organization_id,id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id,employment_type_id) REFERENCES employment_types(organization_id,id) ON DELETE CASCADE
);
CREATE INDEX ix_employee_import_legacy_master_refs_org ON employee_import_legacy_master_refs(organization_id);
COMMENT ON TABLE employee_import_legacy_master_refs IS 'Pemetaan nilai dari template impor Pegawai lama ke ID master dalam organisasi yang sama.';

INSERT INTO employee_import_legacy_master_refs (organization_id,legacy_ref,organization_unit_id)
SELECT organization_id,upper(btrim(code)),id FROM organization_units;
INSERT INTO employee_import_legacy_master_refs (organization_id,legacy_ref,position_id)
SELECT organization_id,upper(btrim(code)),id FROM positions;
INSERT INTO employee_import_legacy_master_refs (organization_id,legacy_ref,employment_type_id)
SELECT organization_id,upper(btrim(code)),id FROM employment_types;

ALTER TABLE organization_unit_types DROP COLUMN code;
ALTER TABLE organization_units DROP COLUMN code;
ALTER TABLE positions DROP COLUMN code;
ALTER TABLE employment_types DROP COLUMN code;
ALTER TABLE inventory_categories DROP COLUMN code;
ALTER TABLE inventory_warehouses DROP COLUMN code;
