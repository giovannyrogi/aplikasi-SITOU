import { requirePermission, resolvePermissionOrganization } from "@/lib/auth/permissions";
import {
  errorResponse,
  getRequestId,
  handleRouteError,
  parseListQuery,
  readJson,
  successResponse,
  validateMutationRequest,
} from "@/lib/api/routeHelpers";
import { leaveTypeCreateSchema } from "@/lib/leave/schemas";
import { createLeaveType, getLeaveTypeOptions, listLeaveTypes } from "@/lib/leave/service";

export async function GET(request) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("leave_types.read");
  if (response) return response;
  try {
    const url = new URL(request.url);
    const organizationId = resolvePermissionOrganization(
      user,
      url.searchParams.get("organizationId") || null,
      { optional: true },
    );
    if (url.searchParams.get("options") === "true")
      return successResponse(await getLeaveTypeOptions(organizationId, true));
    const query = parseListQuery(url.searchParams);
    const result = await listLeaveTypes({ ...query, organizationId });
    return successResponse(result.data, {
      pagination: { page: query.page, pageSize: query.pageSize, total: result.total },
    });
  } catch (error) {
    return handleRouteError("leave-types.list", error, requestId);
  }
}
export async function POST(request) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("leave_types.manage");
  if (response) return response;
  const rejected = validateMutationRequest(request, user.id, requestId);
  if (rejected) return rejected;
  const parsed = await readJson(request, leaveTypeCreateSchema, requestId);
  if (parsed.response) return parsed.response;
  try {
    const organizationId = resolvePermissionOrganization(user, parsed.data.organizationId);
    const data = await createLeaveType({ ...parsed.data, organizationId }, user, requestId);
    return successResponse(data, {
      status: 201,
      code: "LEAVE_TYPE_CREATED",
      message: "Aturan cuti atau izin berhasil dibuat.",
    });
  } catch (error) {
    return handleRouteError("leave-types.create", error, requestId);
  }
}
