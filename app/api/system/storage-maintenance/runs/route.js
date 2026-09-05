import { requirePermission, resolvePermissionOrganization } from "@/lib/auth/permissions";
import {
  getRequestId,
  handleRouteError,
  parseListQuery,
  successResponse,
} from "@/lib/api/routeHelpers";
import { listStorageMaintenanceRuns } from "@/lib/storage-maintenance/service";

export async function GET(request) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("storage_maintenance.manage");
  if (response) return response;
  try {
    const searchParams = new URL(request.url).searchParams;
    const query = parseListQuery(searchParams);
    const organizationId = resolvePermissionOrganization(user, searchParams.get("organizationId"));
    const runType = ["scan", "cleanup"].includes(searchParams.get("runType"))
      ? searchParams.get("runType")
      : "all";
    const result = await listStorageMaintenanceRuns({ ...query, organizationId, runType });
    return successResponse(result.data, {
      pagination: { page: query.page, pageSize: query.pageSize, total: result.total },
    });
  } catch (error) {
    return handleRouteError("storage-maintenance.runs", error, requestId);
  }
}
