import { requirePermission, resolvePermissionOrganization } from "@/lib/auth/permissions";
import {
  errorResponse,
  getRequestId,
  handleRouteError,
  successResponse,
} from "@/lib/api/routeHelpers";
import { getEmployeeLeaveSummary } from "@/lib/leave/service";
export async function GET(request, { params }) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("leave_requests.read");
  if (response) return response;
  const { id } = await params;
  if (!/^\d+$/.test(id))
    return errorResponse("INVALID_ID", "ID pegawai tidak valid.", 400, requestId);
  try {
    const url = new URL(request.url);
    const organizationId = resolvePermissionOrganization(
      user,
      url.searchParams.get("organizationId") || null,
    );
    const year = Math.min(
      2100,
      Math.max(2000, Number(url.searchParams.get("year")) || new Date().getFullYear()),
    );
    return successResponse(await getEmployeeLeaveSummary(id, organizationId, user, year));
  } catch (error) {
    return handleRouteError("employee.leave-summary", error, requestId);
  }
}
