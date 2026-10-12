-- Transaksi stok append-only. Draft tidak mengubah saldo.
CREATE TABLE inventory_transactions (
  id uuid PRIMARY KEY,
  organization_id bigint NOT NULL REFERENCES organizations(id),
  warehouse_id bigint,
  kind varchar(20) NOT NULL CHECK (kind IN ('opening','receipt','issue','return','stocktake','reversal')),
  status varchar(12) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','posted')),
  occurred_on date,
  recorded_at timestamptz,
  reference_no varchar(100),
  notes text,
  late_reason text,
  destination_location_id bigint,
  destination_unit_id bigint,
  recipient_employee_id bigint,
  source_transaction_id uuid,
  reversal_of_id uuid,
  draft_payload jsonb,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by_user_id bigint NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,id),
  UNIQUE (organization_id,warehouse_id,id),
  FOREIGN KEY (organization_id,warehouse_id) REFERENCES inventory_warehouses(organization_id,id),
  FOREIGN KEY (organization_id,destination_location_id) REFERENCES locations(organization_id,id),
  FOREIGN KEY (organization_id,destination_unit_id) REFERENCES organization_units(organization_id,id),
  FOREIGN KEY (organization_id,recipient_employee_id) REFERENCES employees(organization_id,id),
  FOREIGN KEY (organization_id,source_transaction_id) REFERENCES inventory_transactions(organization_id,id),
  FOREIGN KEY (organization_id,reversal_of_id) REFERENCES inventory_transactions(organization_id,id),
  CHECK ((status='draft' AND recorded_at IS NULL) OR (status='posted' AND warehouse_id IS NOT NULL AND recorded_at IS NOT NULL AND occurred_on IS NOT NULL)),
  CHECK ((kind='reversal') = (reversal_of_id IS NOT NULL))
);
CREATE UNIQUE INDEX uq_inventory_reversal_once ON inventory_transactions(organization_id,reversal_of_id) WHERE reversal_of_id IS NOT NULL;
CREATE INDEX ix_inventory_transactions_list ON inventory_transactions(organization_id,warehouse_id,occurred_on DESC,id DESC) WHERE status='posted';
CREATE INDEX ix_inventory_transactions_drafts ON inventory_transactions(organization_id,created_by_user_id,created_at DESC) WHERE status='draft';

CREATE TABLE inventory_transaction_lines (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id bigint NOT NULL,
  transaction_id uuid NOT NULL,
  item_id bigint NOT NULL,
  quantity numeric(18,3) NOT NULL CHECK (quantity >= 0),
  delta numeric(18,3) NOT NULL,
  source_line_id bigint,
  UNIQUE (organization_id,id),
  UNIQUE (organization_id,transaction_id,item_id),
  FOREIGN KEY (organization_id,transaction_id) REFERENCES inventory_transactions(organization_id,id),
  FOREIGN KEY (organization_id,item_id) REFERENCES inventory_items(organization_id,id),
  FOREIGN KEY (organization_id,source_line_id) REFERENCES inventory_transaction_lines(organization_id,id)
);
CREATE INDEX ix_inventory_lines_source ON inventory_transaction_lines(organization_id,source_line_id) WHERE source_line_id IS NOT NULL;

CREATE TABLE inventory_stock_openings (
  organization_id bigint NOT NULL,
  warehouse_id bigint NOT NULL,
  item_id bigint NOT NULL,
  transaction_id uuid NOT NULL,
  occurred_on date NOT NULL,
  PRIMARY KEY (organization_id,warehouse_id,item_id),
  FOREIGN KEY (organization_id,warehouse_id,transaction_id) REFERENCES inventory_transactions(organization_id,warehouse_id,id),
  FOREIGN KEY (organization_id,item_id,warehouse_id) REFERENCES inventory_item_warehouses(organization_id,item_id,warehouse_id)
);

CREATE TABLE inventory_stock_movements (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id bigint NOT NULL,
  warehouse_id bigint NOT NULL,
  item_id bigint NOT NULL,
  transaction_id uuid NOT NULL,
  line_id bigint NOT NULL,
  occurred_on date NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  delta numeric(18,3) NOT NULL,
  UNIQUE (organization_id,line_id),
  FOREIGN KEY (organization_id,warehouse_id,transaction_id) REFERENCES inventory_transactions(organization_id,warehouse_id,id),
  FOREIGN KEY (organization_id,line_id) REFERENCES inventory_transaction_lines(organization_id,id),
  FOREIGN KEY (organization_id,item_id,warehouse_id) REFERENCES inventory_item_warehouses(organization_id,item_id,warehouse_id)
);
CREATE INDEX ix_inventory_movements_history ON inventory_stock_movements(organization_id,warehouse_id,item_id,occurred_on,id);

CREATE TABLE inventory_stock_balances (
  organization_id bigint NOT NULL,
  warehouse_id bigint NOT NULL,
  item_id bigint NOT NULL,
  quantity numeric(18,3) NOT NULL CHECK (quantity >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id,warehouse_id,item_id),
  FOREIGN KEY (organization_id,item_id,warehouse_id) REFERENCES inventory_item_warehouses(organization_id,item_id,warehouse_id)
);

CREATE TABLE inventory_transaction_files (
  organization_id bigint NOT NULL,
  transaction_id uuid NOT NULL,
  file_id bigint NOT NULL,
  purpose varchar(24) NOT NULL CHECK (purpose IN ('purchase_proof','request_document','handover_photo')),
  PRIMARY KEY (organization_id,transaction_id,file_id),
  FOREIGN KEY (organization_id,transaction_id) REFERENCES inventory_transactions(organization_id,id),
  FOREIGN KEY (organization_id,file_id) REFERENCES stored_files(organization_id,id)
);

INSERT INTO permissions(code,description) VALUES
 ('inventory.transactions.create','Mencatat transaksi stok pada gudang berizin'),
 ('inventory.transactions.cancel','Membatalkan transaksi stok pada gudang berizin');
INSERT INTO access_package_permissions(package_code,permission_id)
 SELECT 'inventory_manager',id FROM permissions WHERE code IN ('inventory.transactions.create','inventory.transactions.cancel');
INSERT INTO role_permissions(role_id,permission_id)
 SELECT role.id,permission.id FROM roles role CROSS JOIN permissions permission
 WHERE role.code='superadmin' AND permission.code IN ('inventory.transactions.create','inventory.transactions.cancel');
COMMENT ON TABLE inventory_stock_movements IS 'Riwayat perubahan stok append-only; saldo dihitung ulang ketika transaksi bertanggal lampau diposting.';
