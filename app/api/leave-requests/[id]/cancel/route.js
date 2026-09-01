import { requirePermission, resolvePermissionOrganization } from "@/lib/auth/permissions";
import {
  errorResponse,
  getRequestId,
  handleRouteError,
  readJson,
  successResponse,
  validateMutationRequest,
} from "@/lib/api/routeHelpers";
import { leaveCancelSchema } from "@/lib/leave/schemas";
import { cancelLeaveRequest } from "@/lib/leave/service";
export async function POST(request, { params }) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("leave_requests.manage");
  if (response) return response;
  const rejected = validateMutationRequest(request, user.id, requestId);
  if (rejected) return rejected;
  const { id } = await params;
  if (!/^\d+$/.test(id))
    return errorResponse("INVALID_ID", "ID pencatatan tidak valid.", 400, requestId);
  const parsed = await readJson(request, leaveCancelSchema, requestId);
  if (parsed.response) return parsed.response;
  try {
    const organizationId = resolvePermissionOrganization(user, parsed.data.organizationId);
    const data = await cancelLeaveRequest(id, { ...parsed.data, organizationId }, user, requestId);
    return successResponse(data, {
      code: "LEAVE_REQUEST_CANCELLED",
      message: "Pencatatan cuti atau izin berhasil dibatalkan dan saldo telah dikembalikan.",
    });
  } catch (error) {
    return handleRouteError("leave-requests.cancel", error, requestId);
  }
}
