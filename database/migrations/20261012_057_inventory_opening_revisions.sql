-- Tidak mengubah dokumen, ledger, atau saldo lama. Proyeksi legacy disalin persis.
ALTER TABLE inventory_transaction_lines ADD UNIQUE(organization_id,item_id,id);
ALTER TABLE inventory_stock_movements ADD UNIQUE(organization_id,line_id,id);
CREATE TABLE inventory_opening_revisions (
 id uuid PRIMARY KEY,
 organization_id bigint NOT NULL,
 warehouse_id bigint NOT NULL,
 item_id bigint NOT NULL,
 original_line_id bigint NOT NULL,
 previous_revision_id uuid,
 occurred_on date NOT NULL,
 quantity numeric(18,3) NOT NULL CHECK(quantity>=0),
 reason text NOT NULL CHECK(length(trim(reason))>=10),
 created_by_user_id bigint NOT NULL REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 operation_id uuid NOT NULL,
 UNIQUE(organization_id,id),
 UNIQUE(organization_id,warehouse_id,item_id,id),
 UNIQUE(organization_id,operation_id,item_id,warehouse_id),
 FOREIGN KEY(organization_id,warehouse_id,item_id) REFERENCES inventory_stock_openings(organization_id,warehouse_id,item_id),
 FOREIGN KEY(organization_id,item_id,original_line_id) REFERENCES inventory_transaction_lines(organization_id,item_id,id),
 FOREIGN KEY(organization_id,warehouse_id,item_id,previous_revision_id) REFERENCES inventory_opening_revisions(organization_id,warehouse_id,item_id,id)
);
CREATE UNIQUE INDEX uq_inventory_opening_revision_chain ON inventory_opening_revisions(organization_id,warehouse_id,item_id,COALESCE(previous_revision_id,'00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX ix_inventory_opening_revision_latest ON inventory_opening_revisions(organization_id,warehouse_id,item_id,created_at DESC);
CREATE TRIGGER inventory_opening_revisions_immutable BEFORE UPDATE OR DELETE ON inventory_opening_revisions
 FOR EACH ROW EXECUTE FUNCTION prevent_inventory_ledger_change();
CREATE TABLE inventory_stock_calculations (
 organization_id bigint NOT NULL,
 warehouse_id bigint NOT NULL,
 item_id bigint NOT NULL,
 version bigint NOT NULL DEFAULT 1,
 state text NOT NULL DEFAULT 'active' CHECK(state IN ('legacy','active')),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,warehouse_id,item_id),
 FOREIGN KEY(organization_id,item_id,warehouse_id) REFERENCES inventory_item_warehouses(organization_id,item_id,warehouse_id)
);
CREATE TABLE inventory_stock_projection (
 organization_id bigint NOT NULL,
 warehouse_id bigint NOT NULL,
 item_id bigint NOT NULL,
 line_id bigint NOT NULL,
 movement_id bigint NOT NULL,
 effective_on date NOT NULL,
 effective_delta numeric(18,3) NOT NULL,
 balance numeric(18,3) NOT NULL CHECK(balance>=0),
 PRIMARY KEY(organization_id,line_id),
 FOREIGN KEY(organization_id,line_id,movement_id) REFERENCES inventory_stock_movements(organization_id,line_id,id),
 FOREIGN KEY(organization_id,line_id) REFERENCES inventory_transaction_lines(organization_id,id),
 FOREIGN KEY(organization_id,item_id,warehouse_id) REFERENCES inventory_item_warehouses(organization_id,item_id,warehouse_id)
);
CREATE INDEX ix_inventory_projection_history ON inventory_stock_projection(organization_id,warehouse_id,item_id,effective_on,movement_id);
INSERT INTO inventory_stock_calculations(organization_id,warehouse_id,item_id,state)
 SELECT DISTINCT organization_id,warehouse_id,item_id,'legacy' FROM inventory_stock_movements;
INSERT INTO inventory_stock_projection(organization_id,warehouse_id,item_id,line_id,movement_id,effective_on,effective_delta,balance)
 SELECT organization_id,warehouse_id,item_id,line_id,id,occurred_on,delta,
 sum(delta) OVER(PARTITION BY organization_id,warehouse_id,item_id ORDER BY occurred_on,id ROWS UNBOUNDED PRECEDING)
 FROM inventory_stock_movements;
INSERT INTO permissions(code,description) VALUES('inventory.openings.correct','Mengoreksi saldo awal pada gudang dengan izin pengelolaan dan koreksi');
INSERT INTO access_packages(code,module_code,name) VALUES('inventory_opening_corrector','inventory','Koreksi Saldo Awal');
INSERT INTO access_package_permissions(package_code,permission_id)
 SELECT 'inventory_opening_corrector',id FROM permissions WHERE code='inventory.openings.correct';
INSERT INTO role_permissions(role_id,permission_id)
 SELECT r.id,p.id FROM roles r CROSS JOIN permissions p WHERE r.code='superadmin' AND p.code='inventory.openings.correct';
