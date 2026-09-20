import {
  ensureActorEmployeeAccess,
  requirePermission,
  resolvePermissionOrganization,
} from "@/lib/auth/permissions";
import { getRequestId, handleRouteError, successResponse } from "@/lib/api/routeHelpers";
import { getEmployeeDisciplineHistory } from "@/lib/discipline/service";

/** Menampilkan kasus dan seluruh tindakan disiplin pada detail pegawai. */
export async function GET(request, { params }) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("discipline.read");
  if (response) return response;
  const employeePermission = await requirePermission("employees.read");
  if (employeePermission.response) return employeePermission.response;
  try {
    const { id } = await params;
    const searchParams = new URL(request.url).searchParams;
    const organizationId = resolvePermissionOrganization(user, searchParams.get("organizationId"));
    await ensureActorEmployeeAccess(user, id, organizationId);
    return successResponse(
      await getEmployeeDisciplineHistory(id, organizationId, user, {
        officialOnly: searchParams.get("officialOnly") === "1",
      }),
    );
  } catch (error) {
    return handleRouteError("employees.discipline-history", error, requestId);
  }
}
