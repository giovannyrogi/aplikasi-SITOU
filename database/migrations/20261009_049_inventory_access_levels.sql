-- Lihat Saja tetap membaca data operasional, tetapi tidak membuka master Inventaris.
DELETE FROM access_package_permissions mapping
USING permissions permission
WHERE mapping.permission_id=permission.id
  AND mapping.package_code='inventory_reader'
  AND permission.code='inventory.master.read';
UPDATE access_packages SET name='Lihat Saja Persediaan' WHERE code='inventory_reader';
