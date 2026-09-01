import { requirePermission, resolvePermissionOrganization } from "@/lib/auth/permissions";
import {
  errorResponse,
  getRequestId,
  handleRouteError,
  successResponse,
} from "@/lib/api/routeHelpers";
import { getLeaveRequest } from "@/lib/leave/service";
export async function GET(request, { params }) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("leave_requests.read");
  if (response) return response;
  const { id } = await params;
  if (!/^\d+$/.test(id))
    return errorResponse("INVALID_ID", "ID pencatatan tidak valid.", 400, requestId);
  try {
    const organizationId = resolvePermissionOrganization(
      user,
      new URL(request.url).searchParams.get("organizationId") || null,
    );
    return successResponse(await getLeaveRequest(id, organizationId, user));
  } catch (error) {
    return handleRouteError("leave-requests.detail", error, requestId);
  }
}
