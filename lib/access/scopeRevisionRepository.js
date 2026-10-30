import pool from "@/lib/dbConfig";
import { scopeRevisionFromState } from "./scopeRevision.mjs";

/** Membaca scope aktif dari database agar pergantian lokasi/gudang terdeteksi tanpa hak baru di browser. */
export async function readAccessScopeRevision(actor, database = pool) {
  if (actor.role_code === "superadmin") return "platform";
  const [locations, packages, modules] = await Promise.all([
    actor.role_code === "hrd" && actor.location_scope_mode === "selected"
      ? database.query(
          `SELECT location_id::text AS id FROM user_location_scopes
           WHERE organization_id=$1 AND user_organization_role_id=$2 ORDER BY location_id`,
          [actor.organization_id, actor.role_assignment_id],
        )
      : Promise.resolve({ rows: [] }),
    database.query(
      `SELECT grant_record.package_code AS code,grant_record.scope_mode AS mode,
        COALESCE(module.is_enabled,false) AS module_enabled,
        COALESCE(array_agg(scope.warehouse_id::text ORDER BY scope.warehouse_id)
          FILTER (WHERE scope.warehouse_id IS NOT NULL),ARRAY[]::text[]) AS warehouse_ids
       FROM user_access_packages grant_record
       JOIN access_packages package ON package.code=grant_record.package_code
       LEFT JOIN organization_modules module ON module.organization_id=grant_record.organization_id
         AND module.module_code=package.module_code
       LEFT JOIN user_package_warehouse_scopes scope ON scope.organization_id=grant_record.organization_id
         AND scope.grant_id=grant_record.id
       WHERE grant_record.organization_id=$1 AND grant_record.membership_id=$2
         AND grant_record.is_active
       GROUP BY grant_record.id,module.is_enabled
       ORDER BY grant_record.package_code,grant_record.id`,
      [actor.organization_id, actor.role_assignment_id],
    ),
    database.query(
      "SELECT module_code AS code,is_enabled AS enabled FROM organization_modules WHERE organization_id=$1 AND module_code IN ('inventory','attendance') ORDER BY module_code",
      [actor.organization_id],
    ),
  ]);
  return scopeRevisionFromState({
    organizationId: actor.organization_id,
    membershipId: actor.role_assignment_id,
    locationMode: actor.role_code === "hrd" ? actor.location_scope_mode : "all",
    locationIds: locations.rows.map((row) => row.id),
    packages: packages.rows.map((row) => ({
      code: row.code,
      mode: row.mode,
      moduleEnabled: row.module_enabled,
      warehouseIds: row.warehouse_ids,
    })),
    modules: modules.rows,
  });
}
