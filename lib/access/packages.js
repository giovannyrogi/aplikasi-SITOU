import pool from "@/lib/dbConfig";
import { withTransaction } from "@/lib/dbTransaction";
import { ServiceError } from "@/lib/api/routeHelpers";
import { writeAudit } from "@/lib/audit";
import {
  readModule,
  readPackageGrants,
  readDelegateLocations,
  readCapabilityRows,
} from "./packageRepository";
import { grantKey, INVENTORY_READ_PERMISSIONS } from "./packagePolicy.mjs";

export async function getAccessSnapshot(actor) {
  if (actor.role_code === "superadmin")
    return {
      inventoryVisible: true,
      permissions: INVENTORY_READ_PERMISSIONS,
      canCreateWarehouse: true,
    };
  const rows = await readCapabilityRows(actor);
  const permissions = INVENTORY_READ_PERMISSIONS.filter((code) =>
    rows.some((row) => row.code === code),
  );
  return {
    inventoryVisible: permissions.length > 0,
    permissions,
    canCreateWarehouse: rows.some(
      (row) => row.code === "inventory.warehouses.create" && row.scope_mode === "all",
    ),
  };
}

export async function getPackageOptions(organizationId, actor, database = pool) {
  const locations = await readDelegateLocations(actor, database);
  const [module, packages, warehouses] = await Promise.all([
    readModule(organizationId, database),
    database.query(
      "SELECT code,name FROM access_packages WHERE module_code='inventory' ORDER BY name",
    ),
    database.query(
      `SELECT warehouse.id::text,warehouse.name,location.name AS location_name FROM inventory_warehouses warehouse
      JOIN locations location ON location.organization_id=warehouse.organization_id AND location.id=warehouse.location_id
      WHERE warehouse.organization_id=$1 AND warehouse.is_active AND location.is_active
      AND location.operational_from<=current_date AND (location.operational_until IS NULL OR location.operational_until>=current_date)
      AND ($2::bigint[] IS NULL OR warehouse.location_id=ANY($2::bigint[])) ORDER BY warehouse.name`,
      [organizationId, locations],
    ),
  ]);
  return {
    inventoryEnabled: module.is_enabled,
    packages: packages.rows,
    warehouses: warehouses.rows,
    canGrantAll: locations === null,
  };
}

/** Appel dari transaksi akun; input yang dihilangkan mempertahankan grant lama. */
export async function replaceAccountPackages(
  client,
  { organizationId, membershipId, userId, grants, actor, requestId },
) {
  if (grants === undefined) return;
  const before = await readPackageGrants(organizationId, [membershipId], client);
  const same =
    before.length === grants.length &&
    before.every((old) => grants.some((g) => grantKey(old) === grantKey(g)));
  if (same) return;
  if (
    actor.role_code !== "superadmin" &&
    (actor.role_code !== "hrd" ||
      String(actor.organization_id) !== String(organizationId) ||
      String(actor.id) === String(userId))
  )
    throw new ServiceError(
      "PACKAGE_DELEGATION_FORBIDDEN",
      "Anda tidak dapat mengubah paket akses akun ini.",
      403,
    );
  const delegation = await client.query(
    `SELECT EXISTS(SELECT 1 FROM role_permissions mapping JOIN roles role ON role.id=mapping.role_id JOIN permissions permission ON permission.id=mapping.permission_id WHERE role.code=$1 AND permission.code='access.packages.delegate') AS allowed`,
    [actor.role_code],
  );
  if (!delegation.rows[0].allowed)
    throw new ServiceError(
      "PACKAGE_DELEGATION_FORBIDDEN",
      "Anda tidak memiliki izin memberikan paket akses.",
      403,
    );
  // Serialize grant/gudang mutations per organisasi; NO KEY UPDATE tetap kompatibel dengan FK.
  await client.query("SELECT id FROM organizations WHERE id=$1 FOR NO KEY UPDATE", [
    organizationId,
  ]);
  const moduleRecord = await client.query(
    "SELECT is_enabled FROM organization_modules WHERE organization_id=$1 AND module_code='inventory' FOR SHARE",
    [organizationId],
  );
  const locationScope = await readDelegateLocations(actor, client);
  for (const old of before) {
    if (grants.some((g) => grantKey(old) === grantKey(g))) continue;
    if (locationScope !== null) {
      const outside = await client.query(
        `SELECT EXISTS(SELECT 1 FROM user_package_warehouse_scopes scope JOIN inventory_warehouses warehouse ON warehouse.organization_id=scope.organization_id AND warehouse.id=scope.warehouse_id WHERE scope.organization_id=$1 AND scope.grant_id=$2 AND NOT(warehouse.location_id=ANY($3::bigint[]))) AS outside`,
        [organizationId, old.id, locationScope],
      );
      if (old.scopeMode === "all" || outside.rows[0].outside)
        throw new ServiceError(
          "PACKAGE_SCOPE_FORBIDDEN",
          "Paket lama berada di luar kewenangan Anda. Hubungi Superadmin.",
          403,
        );
    }
  }
  for (const [index, grant] of grants.entries()) {
    if (before.some((old) => grantKey(old) === grantKey(grant))) continue;
    const fail = (message) => {
      throw new ServiceError("PACKAGE_SCOPE_INVALID", message, 400, {
        [`packageAccess.${index}.warehouseIds`]: message,
      });
    };
    if (!moduleRecord.rows[0]?.is_enabled)
      fail("Modul Inventaris belum aktif pada organisasi ini.");
    const found = await client.query(
      "SELECT code FROM access_packages WHERE code=$1 AND module_code='inventory'",
      [grant.packageCode],
    );
    if (!found.rowCount) fail("Paket akses tidak tersedia.");
    if (grant.scopeMode === "all" && locationScope !== null)
      fail("Cakupan seluruh gudang hanya dapat diberikan oleh pengelola seluruh lokasi.");
    if (grant.scopeMode === "selected") {
      const warehouses = await client.query(
        `SELECT warehouse.id FROM inventory_warehouses warehouse JOIN locations location ON location.organization_id=warehouse.organization_id AND location.id=warehouse.location_id
        WHERE warehouse.organization_id=$1 AND warehouse.id=ANY($2::bigint[]) AND warehouse.is_active AND location.is_active
        AND location.operational_from<=current_date AND (location.operational_until IS NULL OR location.operational_until>=current_date)
        AND ($3::bigint[] IS NULL OR warehouse.location_id=ANY($3::bigint[])) FOR SHARE OF warehouse,location`,
        [organizationId, grant.warehouseIds, locationScope],
      );
      if (!grant.warehouseIds.length || warehouses.rowCount !== grant.warehouseIds.length)
        fail("Pilih gudang aktif dalam cakupan kewenangan Anda.");
    }
  }
  // Pertahankan grant tak berubah, termasuk gudang nonaktif yang masih direferensikan.
  if (
    before.some(
      (old) => old.scopeMode === "all" && !grants.some((g) => grantKey(g) === grantKey(old)),
    )
  )
    await client.query(
      "UPDATE inventory_warehouses SET location_locked=true WHERE organization_id=$1",
      [organizationId],
    );
  for (const old of before)
    if (!grants.some((g) => grantKey(old) === grantKey(g)))
      await client.query(
        "UPDATE user_access_packages SET is_active=false,updated_at=now() WHERE organization_id=$1 AND id=$2",
        [organizationId, old.id],
      );
  for (const grant of grants) {
    if (before.some((old) => grantKey(old) === grantKey(grant))) continue;
    const result = await client.query(
      `INSERT INTO user_access_packages(organization_id,membership_id,package_code,scope_mode) VALUES($1,$2,$3,$4)
      ON CONFLICT(organization_id,membership_id,package_code) DO UPDATE SET scope_mode=EXCLUDED.scope_mode,is_active=true,updated_at=now() RETURNING id`,
      [organizationId, membershipId, grant.packageCode, grant.scopeMode],
    );
    const id = result.rows[0].id;
    await client.query(
      "UPDATE inventory_warehouses SET location_locked=true WHERE organization_id=$1 AND ($2='all' OR id=ANY($3::bigint[]))",
      [organizationId, grant.scopeMode, grant.warehouseIds],
    );
    await client.query(
      "DELETE FROM user_package_warehouse_scopes WHERE organization_id=$1 AND grant_id=$2",
      [organizationId, id],
    );
    if (grant.scopeMode === "selected")
      await client.query(
        "INSERT INTO user_package_warehouse_scopes(organization_id,grant_id,warehouse_id) SELECT $1,$2,unnest($3::bigint[])",
        [organizationId, id, grant.warehouseIds],
      );
  }
  await writeAudit(client, {
    organizationId,
    actorUserId: actor.id,
    action: "access.packages.change",
    entityType: "membership",
    entityId: membershipId,
    beforeData: {
      grants: before.map((g) => ({
        packageCode: g.packageCode,
        scopeMode: g.scopeMode,
        warehouseIds: g.warehouseIds,
      })),
    },
    afterData: { grants },
    requestId,
  });
}

export async function updateModule(organizationId, input, actor, requestId) {
  if (actor.role_code !== "superadmin")
    throw new ServiceError("FORBIDDEN", "Hanya Superadmin dapat mengubah modul organisasi.", 403);
  return withTransaction(async (client) => {
    const organization = await client.query("SELECT id FROM organizations WHERE id=$1 FOR SHARE", [
      organizationId,
    ]);
    if (!organization.rowCount)
      throw new ServiceError("ORGANIZATION_INVALID", "Organisasi tidak tersedia.", 404, {
        organizationId: "Organisasi tidak tersedia.",
      });
    await client.query(
      "INSERT INTO organization_modules(organization_id,module_code) VALUES($1,'inventory') ON CONFLICT DO NOTHING",
      [organizationId],
    );
    const before = (
      await client.query(
        "SELECT is_enabled,version FROM organization_modules WHERE organization_id=$1 AND module_code='inventory' FOR UPDATE",
        [organizationId],
      )
    ).rows[0];
    // Versi 0 adalah modul yang belum pernah dikonfigurasi.
    if (
      before.version !== input.version &&
      !(input.version === 0 && before.version === 1 && !before.is_enabled)
    )
      throw new ServiceError(
        "VERSION_CONFLICT",
        "Pengaturan modul telah berubah. Muat ulang lalu coba kembali.",
        409,
      );
    const row = (
      await client.query(
        "UPDATE organization_modules SET is_enabled=$2,version=version+1,updated_at=now() WHERE organization_id=$1 AND module_code='inventory' RETURNING is_enabled,version",
        [organizationId, input.isEnabled],
      )
    ).rows[0];
    await writeAudit(client, {
      organizationId,
      actorUserId: actor.id,
      action: "access.module.change",
      entityType: "module",
      entityId: "inventory",
      beforeData: before,
      afterData: row,
      requestId,
    });
    return row;
  });
}
