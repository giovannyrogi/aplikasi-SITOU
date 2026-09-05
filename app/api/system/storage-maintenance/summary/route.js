import { requirePermission, resolvePermissionOrganization } from "@/lib/auth/permissions";
import { getRequestId, handleRouteError, successResponse } from "@/lib/api/routeHelpers";
import { getStorageMaintenanceSummary } from "@/lib/storage-maintenance/service";

export async function GET(request) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("storage_maintenance.manage");
  if (response) return response;
  try {
    const organizationId = resolvePermissionOrganization(
      user,
      new URL(request.url).searchParams.get("organizationId"),
    );
    return successResponse(await getStorageMaintenanceSummary(organizationId));
  } catch (error) {
    return handleRouteError("storage-maintenance.summary", error, requestId);
  }
}
