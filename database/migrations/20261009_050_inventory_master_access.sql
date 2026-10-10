-- Pisahkan master organisasi dari operasional gudang tanpa memberi grant baru otomatis.
INSERT INTO access_packages(code,module_code,name)
VALUES('inventory_master','inventory','Pengelola Master Inventaris');
UPDATE access_packages SET name='Pengelola Gudang' WHERE code='inventory_manager';
DELETE FROM access_package_permissions mapping USING permissions permission
WHERE mapping.permission_id=permission.id AND mapping.package_code='inventory_manager'
  AND permission.code IN ('inventory.master.read','inventory.catalog.create','inventory.catalog.update',
    'inventory.warehouses.create','inventory.warehouses.update');
INSERT INTO access_package_permissions(package_code,permission_id)
SELECT 'inventory_master',id FROM permissions WHERE code IN (
  'inventory.master.read','inventory.catalog.read','inventory.catalog.create','inventory.catalog.update',
  'inventory.warehouses.read','inventory.warehouses.create','inventory.warehouses.update');
ALTER TABLE user_access_packages ADD CONSTRAINT ck_inventory_master_organization_scope
CHECK(package_code <> 'inventory_master' OR scope_mode='all');
