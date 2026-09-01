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
import { leaveListFilterSchema, leaveRequestCreateSchema } from "@/lib/leave/schemas";
import { createLeaveRequest, listLeaveRequests } from "@/lib/leave/service";

const filterInput = (params) => ({
  organizationId: params.get("organizationId") || null,
  employeeId: params.get("employeeId") || null,
  leaveTypeId: params.get("leaveTypeId") || null,
  locationId: params.get("locationId") || null,
  organizationUnitId: params.get("organizationUnitId") || null,
  positionId: params.get("positionId") || null,
  requestStatus: params.get("requestStatus") || "all",
  category: params.get("category") || "all",
  periodState: params.get("periodState") || "all",
  source: params.get("source") || "all",
  balanceMode: params.get("balanceMode") || "all",
  attachment: params.get("attachment") || "all",
  employeeStatus: params.get("employeeStatus") || "all",
  startDate: params.get("startDate") || null,
  endDate: params.get("endDate") || null,
  sort: params.get("sort") || "start_desc",
});
export async function GET(request) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("leave_requests.read");
  if (response) return response;
  try {
    const url = new URL(request.url);
    const parsed = leaveListFilterSchema.safeParse(filterInput(url.searchParams));
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
  const rejected = validateMutationRequest(request, user.id, requestId);
  if (rejected) return rejected;
  const parsed = await readJson(request, leaveRequestCreateSchema, requestId);
  if (parsed.response) return parsed.response;
  try {
    const organizationId = resolvePermissionOrganization(user, parsed.data.organizationId);
    const data = await createLeaveRequest({ ...parsed.data, organizationId }, user, requestId);
    return successResponse(data, {
      status: 201,
      code: "LEAVE_REQUEST_APPROVED",
      message: "Cuti atau izin berhasil dicatat dan disetujui.",
    });
  } catch (error) {
    return handleRouteError("leave-requests.create", error, requestId);
  }
}
