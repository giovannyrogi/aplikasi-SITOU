import pool from "@/lib/dbConfig";
const columns = `warehouse.id::text,warehouse.organization_id::text,warehouse.location_id::text,
  warehouse.code,warehouse.name,warehouse.notes,warehouse.is_active,warehouse.version,
  warehouse.created_at,warehouse.updated_at,location.name AS location_name,
  (warehouse.location_locked OR EXISTS(SELECT 1 FROM user_package_warehouse_scopes scope WHERE scope.organization_id=warehouse.organization_id AND scope.warehouse_id=warehouse.id)
  OR EXISTS(SELECT 1 FROM user_access_packages grant_record WHERE grant_record.organization_id=warehouse.organization_id AND grant_record.scope_mode='all' AND grant_record.is_active)) AS location_locked`;
export async function listWarehouseRows(
  { organizationId, scope, search, status, page, pageSize },
  database = pool,
) {
  const where = `FROM inventory_warehouses warehouse JOIN locations location ON location.organization_id=warehouse.organization_id AND location.id=warehouse.location_id
    WHERE warehouse.organization_id=$1 AND ($2::bigint[] IS NULL OR warehouse.id=ANY($2::bigint[]))
    AND ($3='' OR warehouse.name ILIKE $3 OR warehouse.code ILIKE $3 OR location.name ILIKE $3)
    AND ($4='all' OR warehouse.is_active=($4='active'))`;
  const params = [organizationId, scope, search ? `%${search}%` : "", status];
  const [data, count] = await Promise.all([
    database.query(
      `SELECT ${columns} ${where} ORDER BY warehouse.name,warehouse.id LIMIT $5 OFFSET $6`,
      [...params, pageSize, (page - 1) * pageSize],
    ),
    database.query(`SELECT count(*)::int total ${where}`, params),
  ]);
  return { data: data.rows, total: count.rows[0].total };
}
export async function getWarehouseRow(organizationId, id, database = pool) {
  return (
    await database.query(
      `SELECT ${columns} FROM inventory_warehouses warehouse JOIN locations location ON location.organization_id=warehouse.organization_id AND location.id=warehouse.location_id WHERE warehouse.organization_id=$1 AND warehouse.id=$2`,
      [organizationId, id],
    )
  ).rows[0];
}
