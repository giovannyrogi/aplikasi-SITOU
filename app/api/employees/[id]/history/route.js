import { parsePositiveInteger } from "@/app/utils/apiValidation";
import {
  ensureActorEmployeeAccess,
  requirePermission,
  resolvePermissionOrganization,
} from "@/lib/auth/permissions";
import {
  errorResponse,
  getRequestId,
  handleRouteError,
  successResponse,
} from "@/lib/api/routeHelpers";
import { getEmployeeHistory } from "@/lib/employees/service";

/** Menyatukan histori kontrak dan penempatan untuk timeline pegawai. */
export async function GET(request, context) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("employees.read");
  if (response) return response;
  const id = parsePositiveInteger((await context.params).id, "ID pegawai");
  if (id.error) return errorResponse("INVALID_ID", id.error, 400, requestId);
  try {
    const organizationId = resolvePermissionOrganization(
      user,
      new URL(request.url).searchParams.get("organizationId"),
    );
    await ensureActorEmployeeAccess(user, id.value, organizationId);
    return successResponse(await getEmployeeHistory(id.value, organizationId));
  } catch (error) {
    return handleRouteError("employees.history", error, requestId);
  }
}
