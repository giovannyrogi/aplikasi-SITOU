import { requirePermission, resolvePermissionOrganization } from "@/lib/auth/permissions";
import { getRequestId, handleRouteError, successResponse } from "@/lib/api/routeHelpers";
import { listQuarantineItems } from "@/lib/storage-maintenance/service";

export async function GET(request) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("storage_maintenance.manage");
  if (response) return response;
  try {
    const params = new URL(request.url).searchParams;
    const organizationId = resolvePermissionOrganization(user, params.get("organizationId"));
    const page = Math.max(1, Number.parseInt(params.get("page") || "1", 10) || 1);
    const pageSize = Math.min(100, Math.max(10, Number.parseInt(params.get("pageSize") || "20", 10) || 20));
    const result = await listQuarantineItems(organizationId, { page, pageSize });
    return successResponse(result, { pagination: { page, pageSize, total: result.total } });
  } catch (error) {
    return handleRouteError("storage-maintenance.quarantine-list", error, requestId);
  }
}
