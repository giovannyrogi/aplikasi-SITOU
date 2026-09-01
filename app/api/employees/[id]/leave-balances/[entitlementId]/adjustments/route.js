import { requirePermission, resolvePermissionOrganization } from "@/lib/auth/permissions";
import {
  errorResponse,
  getRequestId,
  handleRouteError,
  readJson,
  successResponse,
  validateMutationRequest,
} from "@/lib/api/routeHelpers";
import { leaveAdjustmentSchema } from "@/lib/leave/schemas";
import { adjustLeaveBalance } from "@/lib/leave/service";
export async function POST(request, { params }) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("leave_balances.manage");
  if (response) return response;
  const rejected = validateMutationRequest(request, user.id, requestId);
  if (rejected) return rejected;
  const { id, entitlementId } = await params;
  if (!/^\d+$/.test(id) || !/^\d+$/.test(entitlementId))
    return errorResponse("INVALID_ID", "ID saldo tidak valid.", 400, requestId);
  const parsed = await readJson(request, leaveAdjustmentSchema, requestId);
  if (parsed.response) return parsed.response;
  try {
    const organizationId = resolvePermissionOrganization(user, parsed.data.organizationId);
    const data = await adjustLeaveBalance(
      id,
      entitlementId,
      { ...parsed.data, organizationId },
      user,
      requestId,
    );
    return successResponse(data, { message: "Saldo cuti berhasil disesuaikan." });
  } catch (error) {
    return handleRouteError("leave-balance.adjust", error, requestId);
  }
}
