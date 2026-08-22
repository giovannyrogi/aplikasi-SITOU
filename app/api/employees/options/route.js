import { requirePermission, resolvePermissionOrganization } from "@/lib/auth/permissions";
import {
  errorResponse,
  getRequestId,
  handleRouteError,
  successResponse,
} from "@/lib/api/routeHelpers";
import { employeeOptionQuerySchema } from "@/lib/employees/schemas";
import { getEmployeeOptions } from "@/lib/employees/service";

/** Menyediakan opsi pegawai aktif untuk atasan dan penautan akun. */
export async function GET(request) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("employees.read");
  if (response) return response;
  try {
    const params = new URL(request.url).searchParams;
    const parsed = employeeOptionQuerySchema.safeParse({
      organizationId: params.get("organizationId"),
      excludeId: params.get("excludeId") || null,
    });
    if (!parsed.success)
      return errorResponse(
        "VALIDATION_ERROR",
        "Parameter opsi pegawai tidak valid.",
        400,
        requestId,
      );
    const organizationId = resolvePermissionOrganization(user, parsed.data.organizationId);
    return successResponse(await getEmployeeOptions(organizationId, parsed.data.excludeId, user));
  } catch (error) {
    return handleRouteError("employees.options", error, requestId);
  }
}
