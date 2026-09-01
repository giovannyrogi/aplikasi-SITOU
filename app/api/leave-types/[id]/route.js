import { requirePermission, resolvePermissionOrganization } from "@/lib/auth/permissions";
import {
  errorResponse,
  getRequestId,
  handleRouteError,
  readJson,
  successResponse,
  validateMutationRequest,
} from "@/lib/api/routeHelpers";
import { leaveTypeUpdateSchema } from "@/lib/leave/schemas";
import { updateLeaveType } from "@/lib/leave/service";

export async function PATCH(request, { params }) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("leave_types.manage");
  if (response) return response;
  const rejected = validateMutationRequest(request, user.id, requestId);
  if (rejected) return rejected;
  const { id } = await params;
  if (!/^\d+$/.test(id))
    return errorResponse("INVALID_ID", "Data aturan cuti atau izin tidak valid.", 400, requestId);
  const parsed = await readJson(request, leaveTypeUpdateSchema, requestId);
  if (parsed.response) return parsed.response;
  try {
    const organizationId = resolvePermissionOrganization(user, parsed.data.organizationId);
    const data = await updateLeaveType(id, { ...parsed.data, organizationId }, user, requestId);
    return successResponse(data, { message: "Aturan cuti atau izin berhasil diperbarui." });
  } catch (error) {
    return handleRouteError("leave-types.update", error, requestId);
  }
}
