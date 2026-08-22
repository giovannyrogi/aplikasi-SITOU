import pool from "@/lib/dbConfig";
import { getAuthenticatedUser, forbiddenResponse, unauthorizedResponse } from "@/app/utils/auth";
import { ROLES } from "@/app/constants/roles";
import { ServiceError } from "@/lib/api/routeHelpers";

/** Memeriksa permission aktif dari database agar authorization tidak bergantung pada UI atau nama role saja. */
export async function requirePermission(permissionCode) {
  const user = await getAuthenticatedUser();
  if (!user) return { user: null, response: unauthorizedResponse() };

  const result = await pool.query(
    `SELECT EXISTS(
      SELECT 1 FROM role_permissions mapping
      JOIN permissions permission ON permission.id=mapping.permission_id
      JOIN roles role ON role.id=mapping.role_id
      WHERE role.code=$1 AND permission.code=$2
    ) AS allowed`,
    [user.role_code, permissionCode],
  );
  if (!result.rows[0].allowed) return { user, response: forbiddenResponse() };
  return { user, response: null };
}

/** Menghasilkan organisasi efektif dari session; Superadmin wajib memilih organisasi target. */
export function resolvePermissionOrganization(
  user,
  requestedOrganizationId,
  { optional = false } = {},
) {
  if (user.role_code === ROLES.SUPERADMIN) {
    if (!requestedOrganizationId && !optional)
      throw new ServiceError("ORGANIZATION_REQUIRED", "Organisasi wajib dipilih.", 400);
    return requestedOrganizationId ? String(requestedOrganizationId) : null;
  }
  if (!user.organization_id)
    throw new ServiceError("ORGANIZATION_REQUIRED", "Akun belum terhubung ke organisasi.", 403);
  if (requestedOrganizationId && String(requestedOrganizationId) !== String(user.organization_id))
    throw new ServiceError(
      "ORGANIZATION_FORBIDDEN",
      "Anda tidak memiliki akses ke organisasi tersebut.",
      403,
    );
  return String(user.organization_id);
}

/** Mengembalikan null untuk akses seluruh lokasi atau daftar ID untuk HRD dengan scope terpilih. */
export async function getActorLocationScope(user, database = pool) {
  if (
    user.role_code !== ROLES.HRD ||
    user.location_scope_mode !== "selected" ||
    !user.role_assignment_id
  )
    return null;

  const result = await database.query(
    `SELECT location_id::text FROM user_location_scopes
      WHERE user_organization_role_id=$1 AND organization_id=$2`,
    [user.role_assignment_id, user.organization_id],
  );
  return result.rows.map((row) => row.location_id);
}

/** Menolak mutation HRD ketika lokasi target berada di luar scope yang diberikan. */
export async function ensureActorLocationAccess(user, locationId, database = pool) {
  const scopedLocationIds = await getActorLocationScope(user, database);
  if (scopedLocationIds && !scopedLocationIds.includes(String(locationId)))
    throw new ServiceError(
      "LOCATION_FORBIDDEN",
      "Lokasi berada di luar cakupan akses akun Anda.",
      403,
    );
}

/** Memastikan HRD selected hanya mengakses pegawai dengan penempatan aktif di dalam scope. */
export async function ensureActorEmployeeAccess(user, employeeId, organizationId, database = pool) {
  const scopedLocationIds = await getActorLocationScope(user, database);
  if (!scopedLocationIds) return;
  const result = await database.query(
    `SELECT assignment.location_id::text FROM employee_assignments assignment
     WHERE assignment.organization_id=$1 AND assignment.employee_id=$2
       AND assignment.assignment_type='primary' AND assignment.effective_from<=current_date
       AND (assignment.effective_until IS NULL OR assignment.effective_until>=current_date)
       AND assignment.location_id=ANY($3::bigint[])
     ORDER BY assignment.effective_from DESC,assignment.id DESC LIMIT 1`,
    [organizationId, employeeId, scopedLocationIds],
  );
  if (!result.rows[0])
    throw new ServiceError(
      "EMPLOYEE_SCOPE_FORBIDDEN",
      "Pegawai berada di luar cakupan lokasi akun Anda.",
      403,
    );
}
