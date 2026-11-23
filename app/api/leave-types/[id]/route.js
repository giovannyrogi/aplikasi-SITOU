import { requirePermission, resolvePermissionOrganization } from "@/lib/auth/permissions";
import {
  errorResponse,
  getRequestId,
  handleRouteError,
  readJson,
  readMultipartJson,
  successResponse,
  validateMutationRequest,
} from "@/lib/api/routeHelpers";
import { leaveTypeUpdateSchema } from "@/lib/leave/schemas";
import { updateLeaveType } from "@/lib/leave/service";

export async function PATCH(request, { params }) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("leave_types.manage");
  if (response) return response;
  const rejected = await validateMutationRequest(request, user.id, requestId, {
    maxBytes: 11 * 1024 * 1024,
  });
  if (rejected) return rejected;
  const { id } = await params;
  if (!/^\d+$/.test(id))
    return errorResponse("INVALID_ID", "Data aturan cuti atau izin tidak valid.", 400, requestId);
  const parsed = request.headers.get("content-type")?.startsWith("multipart/form-data")
    ? await readMultipartJson(request, leaveTypeUpdateSchema, requestId)
    : await readJson(request, leaveTypeUpdateSchema, requestId);
  if (parsed.response) return parsed.response;
  try {
    const organizationId = resolvePermissionOrganization(user, parsed.data.organizationId);
    const data = await updateLeaveType(
      id,
      { ...parsed.data, organizationId },
      user,
      requestId,
      parsed.file,
    );
    return successResponse(data, { message: "Aturan cuti atau izin berhasil diperbarui." });
  } catch (error) {
    return handleRouteError("leave-types.update", error, requestId);
  } finally {
    await parsed.cleanup?.();
  }
}
