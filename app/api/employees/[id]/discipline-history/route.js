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
  try {
    const { id } = await params;
    const organizationId = resolvePermissionOrganization(
      user,
      new URL(request.url).searchParams.get("organizationId"),
    );
    await ensureActorEmployeeAccess(user, id, organizationId);
    return successResponse(await getEmployeeDisciplineHistory(id, organizationId));
  } catch (error) {
    return handleRouteError("employees.discipline-history", error, requestId);
  }
}
