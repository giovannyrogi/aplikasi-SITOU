CREATE TABLE inventory_categories (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, organization_id bigint NOT NULL REFERENCES organizations(id),
 code varchar(40) NOT NULL CHECK(code=upper(trim(code)) AND code ~ '^[A-Z0-9_-]+$'),
 name varchar(100) NOT NULL CHECK(length(trim(name))>0), notes text, is_active boolean NOT NULL DEFAULT true,
 version integer NOT NULL DEFAULT 1 CHECK(version>0), created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,id),UNIQUE(organization_id,code)
);
CREATE UNIQUE INDEX uq_inventory_category_name ON inventory_categories(organization_id,lower(trim(name)));
CREATE TABLE inventory_units (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, organization_id bigint NOT NULL REFERENCES organizations(id),
 code varchar(40) NOT NULL CHECK(code=upper(trim(code)) AND code ~ '^[A-Z0-9_-]+$'),
 name varchar(100) NOT NULL CHECK(length(trim(name))>0), notes text, allows_fractional boolean NOT NULL DEFAULT false,
 is_active boolean NOT NULL DEFAULT true,version integer NOT NULL DEFAULT 1 CHECK(version>0),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,id),UNIQUE(organization_id,code)
);
CREATE UNIQUE INDEX uq_inventory_unit_name ON inventory_units(organization_id,lower(trim(name)));
CREATE TABLE inventory_items (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,organization_id bigint NOT NULL REFERENCES organizations(id),
 code varchar(40) NOT NULL CHECK(code=upper(trim(code)) AND code ~ '^[A-Z0-9_-]+$'),name varchar(160) NOT NULL CHECK(length(trim(name))>0),
 category_id bigint NOT NULL,unit_id bigint NOT NULL,photo_file_id bigint,notes text,is_active boolean NOT NULL DEFAULT true,
 version integer NOT NULL DEFAULT 1 CHECK(version>0),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,id),UNIQUE(organization_id,code),
 FOREIGN KEY(organization_id,category_id) REFERENCES inventory_categories(organization_id,id),
 FOREIGN KEY(organization_id,unit_id) REFERENCES inventory_units(organization_id,id),
 FOREIGN KEY(organization_id,photo_file_id) REFERENCES stored_files(organization_id,id)
);
CREATE TABLE inventory_item_warehouses (
 organization_id bigint NOT NULL,item_id bigint NOT NULL,warehouse_id bigint NOT NULL,
 minimum_stock numeric(18,3) NOT NULL DEFAULT 0 CHECK(minimum_stock>=0),is_active boolean NOT NULL DEFAULT true,
 version integer NOT NULL DEFAULT 1 CHECK(version>0),updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,item_id,warehouse_id),
 FOREIGN KEY(organization_id,item_id) REFERENCES inventory_items(organization_id,id),
 FOREIGN KEY(organization_id,warehouse_id) REFERENCES inventory_warehouses(organization_id,id)
);
CREATE INDEX ix_inventory_items_category ON inventory_items(organization_id,category_id,id);
CREATE INDEX ix_inventory_items_unit ON inventory_items(organization_id,unit_id,id);
CREATE INDEX ix_inventory_item_warehouses_scope ON inventory_item_warehouses(organization_id,warehouse_id,item_id);
COMMENT ON TABLE inventory_items IS 'Katalog bersama organisasi; tidak menyimpan saldo stok atau aset.';
COMMENT ON TABLE inventory_item_warehouses IS 'Ketersediaan katalog dan batas minimum per gudang; saldo berasal dari ledger pada tahap transaksi berikutnya.';
INSERT INTO permissions(code,description) VALUES
 ('inventory.catalog.read','Membaca katalog bersama organisasi'),('inventory.catalog.create','Menambah katalog dengan cakupan seluruh gudang'),
 ('inventory.catalog.update','Mengubah katalog dengan cakupan seluruh gudang'),('inventory.item_warehouses.update','Mengatur barang dan stok minimum gudang berizin');
INSERT INTO access_package_permissions(package_code,permission_id)
 SELECT package.code,permission.id FROM access_packages package CROSS JOIN permissions permission
 WHERE package.module_code='inventory' AND permission.code IN ('inventory.catalog.read','inventory.catalog.create','inventory.catalog.update','inventory.item_warehouses.update')
 AND (package.code='inventory_manager' OR permission.code='inventory.catalog.read');
INSERT INTO role_permissions(role_id,permission_id) SELECT role.id,permission.id FROM roles role CROSS JOIN permissions permission
 WHERE role.code='superadmin' AND permission.code IN ('inventory.catalog.read','inventory.catalog.create','inventory.catalog.update','inventory.item_warehouses.update');
