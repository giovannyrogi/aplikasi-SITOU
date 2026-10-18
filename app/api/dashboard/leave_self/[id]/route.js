import { requireAuthenticatedUser } from "@/app/utils/auth";
import { getLeaveRequest } from "@/lib/leave/service";
import { requireSelfLeaveAccess } from "@/lib/leave/selfAccess";
import {
  getRequestId,
  handleRouteError,
  successResponse,
  ServiceError,
} from "@/lib/api/routeHelpers";

export async function GET(request, { params }) {
  const requestId = getRequestId(request);
  const { user, response } = await requireAuthenticatedUser();
  if (response) return response;
  try {
    await requireSelfLeaveAccess(user, user.organization_id);
    const { id } = await params;
    if (!/^[1-9]\d*$/.test(id) || new URL(request.url).search)
      throw new ServiceError("VALIDATION_ERROR", "Pilihan rincian tidak valid.", 400);
    return successResponse(await getLeaveRequest(id, user.organization_id, user, undefined, { selfOnly: true }));
  } catch (error) {
    return handleRouteError("dashboard.leave_self", error, requestId);
  }
}
