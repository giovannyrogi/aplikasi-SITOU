import { requirePermission, resolvePermissionOrganization } from "@/lib/auth/permissions";
import {
  errorResponse,
  getRequestId,
  handleRouteError,
  parseListQuery,
  validateMutationRequest,
} from "@/lib/api/routeHelpers";
import { leaveListFilterInput, leaveListFilterSchema } from "@/lib/leave/schemas";
import { exportLeaveRequests } from "@/lib/leave/exportService";

export async function GET(request) {
  const requestId = getRequestId(request);
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  try {
    const { user, response } = await requirePermission("leave_requests.read");
    if (response) return response;
    const denied = await validateMutationRequest(request, user.id, requestId);
    if (denied) return denied;
    const params = new URL(request.url).searchParams;
    const parsed = leaveListFilterSchema.safeParse(leaveListFilterInput(params));
    if (!parsed.success)
      return errorResponse(
        "VALIDATION_ERROR",
        "Periksa filter cuti dan izin.",
        400,
        requestId,
        Object.fromEntries(
          parsed.error.issues.map((issue) => [issue.path.join("."), issue.message]),
        ),
      );
    const organizationId = resolvePermissionOrganization(user, parsed.data.organizationId);
    const result = await exportLeaveRequests(
      { ...parsed.data, organizationId, search: parseListQuery(params).search },
      user,
      requestId,
    );
    return new Response(result.buffer, {
      headers: {
        ...headers,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="sitou-cuti-izin-${result.asOf}.xlsx"`,
      },
    });
  } catch (error) {
    const response = handleRouteError("leave-requests.export", error, requestId);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
}
