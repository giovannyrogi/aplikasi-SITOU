-- Lokasi tetap terkunci setelah pernah dipakai dalam grant, termasuk scope yang berubah.
ALTER TABLE inventory_warehouses ADD COLUMN location_locked boolean NOT NULL DEFAULT false;
UPDATE inventory_warehouses warehouse SET location_locked=true
WHERE EXISTS(SELECT 1 FROM user_package_warehouse_scopes scope WHERE scope.organization_id=warehouse.organization_id AND scope.warehouse_id=warehouse.id)
   OR EXISTS(SELECT 1 FROM user_access_packages grant_record WHERE grant_record.organization_id=warehouse.organization_id AND grant_record.scope_mode='all');
