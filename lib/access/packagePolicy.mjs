export const INVENTORY_READ_PERMISSIONS = [
  "inventory.stock.read",
  "inventory.transactions.read",
  "inventory.reports.read",
  "inventory.master.read",
  "inventory.warehouses.read",
];
export function grantKey(grant) {
  return JSON.stringify([
    grant.packageCode,
    grant.scopeMode,
    [...new Set((grant.warehouseIds || []).map(String))].sort(),
  ]);
}
export function hasScope(scope, warehouseId) {
  return scope === null || scope.includes(String(warehouseId));
}
