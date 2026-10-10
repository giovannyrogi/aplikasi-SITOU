import pool from "@/lib/dbConfig";
import { accessFeatureLabel } from "./featureLabels.mjs";

export async function readPackageGrants(organizationId, membershipIds, database = pool) {
  if (!membershipIds.length) return [];
  return (
    await database.query(
      `SELECT grant_record.id::text,grant_record.membership_id::text,
    grant_record.package_code,package.name,grant_record.scope_mode,COALESCE(module.is_enabled,false) AS module_enabled,
    COALESCE(jsonb_agg(jsonb_build_object('id',warehouse.id::text,'name',warehouse.name,
      'location_name',location.name,'location_id',warehouse.location_id::text,'is_active',warehouse.is_active) ORDER BY warehouse.name)
      FILTER(WHERE warehouse.id IS NOT NULL),'[]'::jsonb) AS warehouses
    FROM user_access_packages grant_record JOIN access_packages package ON package.code=grant_record.package_code
    LEFT JOIN organization_modules module ON module.organization_id=grant_record.organization_id AND module.module_code=package.module_code
    LEFT JOIN user_package_warehouse_scopes scope ON scope.organization_id=grant_record.organization_id AND scope.grant_id=grant_record.id
    LEFT JOIN inventory_warehouses warehouse ON warehouse.organization_id=scope.organization_id AND warehouse.id=scope.warehouse_id
    LEFT JOIN locations location ON location.organization_id=warehouse.organization_id AND location.id=warehouse.location_id
    WHERE grant_record.organization_id=$1 AND grant_record.membership_id=ANY($2::bigint[]) AND grant_record.is_active
    GROUP BY grant_record.id,package.name,module.is_enabled ORDER BY package.name`,
      [organizationId, membershipIds],
    )
  ).rows.map((row) => ({
    ...row,
    name: accessFeatureLabel(row.package_code, row.name),
    warehouseIds: row.warehouses.map((w) => w.id),
    packageCode: row.package_code,
    scopeMode: row.scope_mode,
  }));
}

/** Scope berasal dari grant yang mengandung permission itu sendiri, bukan union semua paket. */
export async function readPermissionScope(actor, organizationId, permissionCode, database = pool) {
  if (actor.role_code !== "superadmin" && String(actor.organization_id) !== String(organizationId))
    return [];
  const enabled = await database.query(
    "SELECT module.is_enabled FROM organization_modules module JOIN organizations organization ON organization.id=module.organization_id AND organization.is_active WHERE module.organization_id=$1 AND module.module_code='inventory'",
    [organizationId],
  );
  if (!enabled.rows[0]?.is_enabled) return [];
  if (actor.role_code === "superadmin") return null;
  const result = await database.query(
    `SELECT grant_record.scope_mode,scope.warehouse_id::text
    FROM user_access_packages grant_record
    JOIN user_organization_roles membership ON membership.organization_id=grant_record.organization_id AND membership.id=grant_record.membership_id
    JOIN users account ON account.id=membership.user_id AND account.is_active
    JOIN access_packages package ON package.code=grant_record.package_code AND package.module_code='inventory'
    JOIN access_package_permissions mapping ON mapping.package_code=grant_record.package_code
    JOIN permissions permission ON permission.id=mapping.permission_id AND permission.code=$3
    LEFT JOIN user_package_warehouse_scopes scope ON scope.organization_id=grant_record.organization_id AND scope.grant_id=grant_record.id
    WHERE grant_record.organization_id=$1 AND membership.id=$2 AND membership.user_id=$4
      AND membership.active_from<=now() AND (membership.active_until IS NULL OR membership.active_until>now())
      AND grant_record.is_active`,
    [organizationId, actor.role_assignment_id, permissionCode, actor.id],
  );
  if (result.rows.some((row) => row.scope_mode === "all")) return null;
  return [...new Set(result.rows.map((row) => row.warehouse_id).filter(Boolean))];
}

export async function readModule(organizationId, database = pool) {
  return (
    (
      await database.query(
        "SELECT is_enabled,version FROM organization_modules WHERE organization_id=$1 AND module_code='inventory'",
        [organizationId],
      )
    ).rows[0] || { is_enabled: false, version: 0 }
  );
}

export async function readCapabilityRows(actor, database = pool) {
  return (
    await database.query(
      `SELECT DISTINCT permission.code,grant_record.scope_mode
    FROM user_access_packages grant_record
    JOIN user_organization_roles membership ON membership.organization_id=grant_record.organization_id AND membership.id=grant_record.membership_id
    JOIN users account ON account.id=membership.user_id AND account.is_active
    JOIN organizations organization ON organization.id=membership.organization_id AND organization.is_active
    JOIN organization_modules module_state ON module_state.organization_id=membership.organization_id AND module_state.module_code='inventory' AND module_state.is_enabled
    JOIN access_packages package ON package.code=grant_record.package_code AND package.module_code='inventory'
    JOIN access_package_permissions mapping ON mapping.package_code=package.code
    JOIN permissions permission ON permission.id=mapping.permission_id
    LEFT JOIN user_package_warehouse_scopes scope ON scope.organization_id=grant_record.organization_id AND scope.grant_id=grant_record.id
    WHERE membership.organization_id=$1 AND membership.id=$2 AND membership.user_id=$3
      AND membership.active_from<=now() AND (membership.active_until IS NULL OR membership.active_until>now())
      AND grant_record.is_active AND (grant_record.scope_mode='all' OR scope.warehouse_id IS NOT NULL)`,
      [actor.organization_id, actor.role_assignment_id, actor.id],
    )
  ).rows;
}

export async function readDelegateLocations(actor, database = pool) {
  if (actor.role_code !== "hrd" || actor.location_scope_mode !== "selected") return null;
  return (
    await database.query(
      "SELECT location_id::text FROM user_location_scopes WHERE organization_id=$1 AND user_organization_role_id=$2",
      [actor.organization_id, actor.role_assignment_id],
    )
  ).rows.map((r) => r.location_id);
}
