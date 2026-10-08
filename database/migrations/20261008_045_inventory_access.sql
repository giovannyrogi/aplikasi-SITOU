-- Fondasi Inventaris: modul, paket akses per membership, dan gudang.
CREATE TABLE access_modules (
  code varchar(40) PRIMARY KEY, name varchar(100) NOT NULL
);
CREATE TABLE access_packages (
  code varchar(60) PRIMARY KEY, module_code varchar(40) NOT NULL REFERENCES access_modules(code),
  name varchar(100) NOT NULL, UNIQUE(module_code,code)
);
CREATE TABLE access_package_permissions (
  package_code varchar(60) NOT NULL REFERENCES access_packages(code),
  permission_id bigint NOT NULL REFERENCES permissions(id), PRIMARY KEY(package_code,permission_id)
);
CREATE TABLE organization_modules (
  organization_id bigint NOT NULL REFERENCES organizations(id),
  module_code varchar(40) NOT NULL REFERENCES access_modules(code),
  is_enabled boolean NOT NULL DEFAULT false, version integer NOT NULL DEFAULT 1 CHECK(version>0),
  updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(organization_id,module_code)
);
CREATE TABLE inventory_warehouses (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id bigint NOT NULL REFERENCES organizations(id), location_id bigint NOT NULL,
  code varchar(40) NOT NULL CHECK(code=upper(trim(code)) AND code ~ '^[A-Z0-9_-]+$'),
  name varchar(100) NOT NULL CHECK(length(trim(name))>0), notes text,
  is_active boolean NOT NULL DEFAULT true, version integer NOT NULL DEFAULT 1 CHECK(version>0),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id,id), UNIQUE(organization_id,code),
  FOREIGN KEY(organization_id,location_id) REFERENCES locations(organization_id,id)
);
CREATE INDEX ix_inventory_warehouses_location ON inventory_warehouses(organization_id,location_id,id);
CREATE TABLE user_access_packages (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id bigint NOT NULL REFERENCES organizations(id), membership_id bigint NOT NULL,
  package_code varchar(60) NOT NULL REFERENCES access_packages(code),
  scope_mode varchar(20) NOT NULL CHECK(scope_mode IN ('all','selected')),
  is_active boolean NOT NULL DEFAULT true, updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id,id), UNIQUE(organization_id,membership_id,package_code),
  FOREIGN KEY(organization_id,membership_id) REFERENCES user_organization_roles(organization_id,id)
);
CREATE TABLE user_package_warehouse_scopes (
  organization_id bigint NOT NULL, grant_id bigint NOT NULL, warehouse_id bigint NOT NULL,
  PRIMARY KEY(organization_id,grant_id,warehouse_id),
  FOREIGN KEY(organization_id,grant_id) REFERENCES user_access_packages(organization_id,id),
  FOREIGN KEY(organization_id,warehouse_id) REFERENCES inventory_warehouses(organization_id,id)
);
CREATE INDEX ix_package_warehouse_reference ON user_package_warehouse_scopes(organization_id,warehouse_id,grant_id);
COMMENT ON TABLE user_access_packages IS 'Paket permission per membership organisasi; permission dan scope harus dievaluasi berpasangan.';
COMMENT ON TABLE inventory_warehouses IS 'Gudang organisasi pada lokasi operasional; bukan saldo stok atau aset.';
COMMENT ON TABLE organization_modules IS 'Aktivasi fitur organisasi terpisah dari paket akun; tanpa record berarti nonaktif.';
INSERT INTO access_modules(code,name) VALUES('inventory','Inventaris');
INSERT INTO access_packages(code,module_code,name) VALUES
 ('inventory_reader','inventory','Pembaca Persediaan'),('inventory_manager','inventory','Pengelola Persediaan');
INSERT INTO permissions(code,description) VALUES
 ('inventory.stock.read','Membuka Stok Barang'),('inventory.transactions.read','Membuka Transaksi Barang'),
 ('inventory.reports.read','Membuka Laporan Distribusi'),('inventory.master.read','Membuka Data Master Inventaris'),
 ('inventory.warehouses.read','Membaca gudang berizin'),('inventory.warehouses.create','Membuat gudang dengan cakupan seluruh gudang'),
 ('inventory.warehouses.update','Mengubah gudang berizin'),('access.packages.delegate','Memberikan paket akses dalam batas delegasi'),
 ('access.modules.manage','Mengaktifkan modul organisasi');
INSERT INTO access_package_permissions(package_code,permission_id)
 SELECT package.code,permission.id FROM access_packages package CROSS JOIN permissions permission
 WHERE permission.code LIKE 'inventory.%' AND
 (package.code='inventory_manager' OR permission.code LIKE '%.read');
INSERT INTO role_permissions(role_id,permission_id)
 SELECT role.id,permission.id FROM roles role CROSS JOIN permissions permission
 WHERE (role.code='superadmin' AND (permission.code LIKE 'inventory.%' OR permission.code LIKE 'access.%'))
 OR (role.code='hrd' AND permission.code='access.packages.delegate');
