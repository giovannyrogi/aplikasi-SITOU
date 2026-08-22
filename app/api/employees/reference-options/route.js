import { requirePermission, resolvePermissionOrganization } from "@/lib/auth/permissions";
import { getRequestId, handleRouteError, successResponse } from "@/lib/api/routeHelpers";
import { getEmployeeReferenceOptions } from "@/lib/employees/service";

/** Mengambil master aktif yang dibutuhkan form dan filter pegawai dalam satu request. */
export async function GET(request) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("employees.read");
  if (response) return response;
  try {
    const organizationId = resolvePermissionOrganization(
      user,
      new URL(request.url).searchParams.get("organizationId"),
    );
    return successResponse(await getEmployeeReferenceOptions(organizationId, user));
  } catch (error) {
    return handleRouteError("employees.reference-options", error, requestId);
  }
}
