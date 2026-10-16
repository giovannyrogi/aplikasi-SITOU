import { requirePermission, resolvePermissionOrganization } from "@/lib/auth/permissions";
import {
  errorResponse,
  getRequestId,
  handleRouteError,
  parseListQuery,
  readJson,
  readMultipartJson,
  successResponse,
  validateMutationRequest,
} from "@/lib/api/routeHelpers";
import { leaveListFilterSchema, leaveListFilterInput, leaveRequestCreateSchema } from "@/lib/leave/schemas";
import { createLeaveRequest, listLeaveRequests } from "@/lib/leave/service";
import { MAX_LEAVE_REQUEST_BYTES } from "@/lib/leave/requestRules.mjs";

export async function GET(request) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("leave_requests.read");
  if (response) return response;
  try {
    const url = new URL(request.url);
    const parsed = leaveListFilterSchema.safeParse(leaveListFilterInput(url.searchParams));
    if (!parsed.success)
      return errorResponse("VALIDATION_ERROR", "Filter cuti dan izin tidak valid.", 400, requestId);
    const organizationId = resolvePermissionOrganization(user, parsed.data.organizationId);
    const query = parseListQuery(url.searchParams);
    const result = await listLeaveRequests({
      ...query,
      ...parsed.data,
      organizationId,
      actor: user,
    });
    return successResponse(result.data, {
      pagination: { page: query.page, pageSize: query.pageSize, total: result.total },
    });
  } catch (error) {
    return handleRouteError("leave-requests.list", error, requestId);
  }
}
export async function POST(request) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("leave_requests.manage");
  if (response) return response;
  const rejected = await validateMutationRequest(request, user.id, requestId, {
    maxBytes: MAX_LEAVE_REQUEST_BYTES,
  });
  if (rejected) return rejected;
  const parsed = await readMultipartJson(request, leaveRequestCreateSchema, requestId, {
    fileField: "files",
  });
  if (parsed.response) return parsed.response;
  try {
    const organizationId = resolvePermissionOrganization(user, parsed.data.organizationId);
    const attachmentFiles = parsed.form
      .getAll("files")
      .filter((file) => file && typeof file.arrayBuffer === "function" && file.size > 0);
    const data = await createLeaveRequest(
      { ...parsed.data, organizationId },
      user,
      requestId,
      attachmentFiles,
    );
    return successResponse(data, {
      status: 201,
      code: "LEAVE_REQUEST_APPROVED",
      message: "Cuti atau izin berhasil dicatat dan disetujui.",
    });
  } catch (error) {
    return handleRouteError("leave-requests.create", error, requestId);
  } finally {
    await parsed.cleanup?.();
  }
}
