import pool from "@/lib/dbConfig";
import { withTransaction } from "@/lib/dbTransaction";
import { ServiceError } from "@/lib/api/routeHelpers";
import { writeAudit } from "@/lib/audit";
import { readPermissionScope } from "@/lib/access/packageRepository";
import { hasScope } from "@/lib/access/packagePolicy.mjs";
import { listWarehouseRows, getWarehouseRow } from "./repository";

export async function requireInventoryAccess(
  actor,
  organizationId,
  permission,
  warehouseId = null,
  database = pool,
) {
  const scope = await readPermissionScope(actor, organizationId, permission, database);
  if ((scope !== null && !scope.length) || (warehouseId && !hasScope(scope, warehouseId)))
    throw new ServiceError(
      "INVENTORY_FORBIDDEN",
      "Anda tidak memiliki akses Inventaris pada cakupan ini.",
      403,
    );
  return scope;
}
export async function listWarehouses(input, actor) {
  const scope = await requireInventoryAccess(
    actor,
    input.organizationId,
    "inventory.warehouses.read",
  );
  const result = await listWarehouseRows({ ...input, scope });
  const edit = await readPermissionScope(
    actor,
    input.organizationId,
    "inventory.warehouses.update",
  );
  const create = await readPermissionScope(
    actor,
    input.organizationId,
    "inventory.warehouses.create",
  );
  return {
    ...result,
    data: result.data.map((row) => ({ ...row, canEdit: hasScope(edit, row.id) })),
    canCreate: create === null,
  };
}
export async function getWarehouseLocations(organizationId, actor) {
  await requireInventoryAccess(actor, organizationId, "inventory.master.read");
  const create = await readPermissionScope(actor, organizationId, "inventory.warehouses.create");
  const edit = await readPermissionScope(actor, organizationId, "inventory.warehouses.update");
  if (create !== null && edit !== null && !edit.length) return [];
  return (
    await pool.query(
      `SELECT id::text,name FROM locations WHERE organization_id=$1 AND is_active
    AND operational_from<=current_date AND (operational_until IS NULL OR operational_until>=current_date) ORDER BY name`,
      [organizationId],
    )
  ).rows;
}
export async function saveWarehouse(id, input, actor, requestId) {
  try {
    return await withTransaction(async (client) => {
      await client.query("SELECT id FROM users WHERE id=$1 FOR SHARE", [actor.id]);
      await client.query("SELECT id FROM organizations WHERE id=$1 FOR NO KEY UPDATE", [
        input.organizationId,
      ]);
      await client.query(
        "SELECT module_code FROM organization_modules WHERE organization_id=$1 AND module_code='inventory' FOR SHARE",
        [input.organizationId],
      );
      const permission = id ? "inventory.warehouses.update" : "inventory.warehouses.create";
      const scope = await requireInventoryAccess(
        actor,
        input.organizationId,
        permission,
        id,
        client,
      );
      if (!id && scope !== null)
        throw new ServiceError(
          "WAREHOUSE_CREATE_FORBIDDEN",
          "Pembuatan gudang memerlukan cakupan seluruh gudang organisasi.",
          403,
        );
      let before = null;
      if (id) {
        await client.query(
          "SELECT id FROM inventory_warehouses WHERE organization_id=$1 AND id=$2 FOR UPDATE",
          [input.organizationId, id],
        );
        before = await getWarehouseRow(input.organizationId, id, client);
        if (!before) throw new ServiceError("NOT_FOUND", "Gudang tidak ditemukan.", 404);
        if (before.version !== input.version)
          throw new ServiceError(
            "VERSION_CONFLICT",
            "Gudang telah berubah. Muat ulang sebelum menyimpan.",
            409,
          );
        if (before.location_locked && String(before.location_id) !== String(input.locationId))
          throw new ServiceError(
            "WAREHOUSE_LOCATION_LOCKED",
            "Lokasi gudang tidak dapat diubah karena telah digunakan dalam cakupan paket.",
            409,
            { locationId: "Lokasi telah digunakan dalam cakupan paket akses." },
          );
      }
      const location = await client.query(
        `SELECT id FROM locations WHERE organization_id=$1 AND id=$2 AND is_active AND operational_from<=current_date AND (operational_until IS NULL OR operational_until>=current_date) FOR SHARE`,
        [input.organizationId, input.locationId],
      );
      if (
        !location.rowCount &&
        (!before ||
          String(before.location_id) !== String(input.locationId) ||
          (input.isActive && !before.is_active))
      )
        throw new ServiceError(
          "LOCATION_INVALID",
          "Pilih lokasi aktif dalam organisasi ini.",
          400,
          { locationId: "Lokasi tidak tersedia." },
        );
      const params = [
        input.organizationId,
        input.locationId,
        input.code,
        input.name,
        input.notes,
        input.isActive,
      ];
      const result = id
        ? await client.query(
            `UPDATE inventory_warehouses SET location_id=$2,code=$3,name=$4,notes=$5,is_active=$6,version=version+1,updated_at=now() WHERE organization_id=$1 AND id=$7 RETURNING id`,
            [...params, id],
          )
        : await client.query(
            `INSERT INTO inventory_warehouses(organization_id,location_id,code,name,notes,is_active) VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,
            params,
          );
      const after = await getWarehouseRow(input.organizationId, result.rows[0].id, client);
      if (after.location_locked)
        await client.query(
          "UPDATE inventory_warehouses SET location_locked=true WHERE organization_id=$1 AND id=$2",
          [input.organizationId, after.id],
        );
      await writeAudit(client, {
        organizationId: input.organizationId,
        actorUserId: actor.id,
        action: id ? "inventory.warehouse.update" : "inventory.warehouse.create",
        entityType: "inventory_warehouse",
        entityId: after.id,
        beforeData: before,
        afterData: after,
        requestId,
      });
      return after;
    });
  } catch (error) {
    if (error.code === "23505")
      throw new ServiceError(
        "WAREHOUSE_CODE_EXISTS",
        "Kode gudang sudah digunakan pada organisasi ini.",
        409,
        { code: "Gunakan kode gudang yang berbeda." },
      );
    throw error;
  }
}
