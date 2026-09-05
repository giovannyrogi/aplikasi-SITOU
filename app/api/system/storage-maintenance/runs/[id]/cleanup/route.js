import { requirePermission, resolvePermissionOrganization } from "@/lib/auth/permissions";
import {
  getRequestId,
  handleRouteError,
  readJson,
  successResponse,
  validateMutationRequest,
} from "@/lib/api/routeHelpers";
import { storageMaintenanceCleanupSchema } from "@/lib/storage-maintenance/schemas";
import { createStorageCleanup } from "@/lib/storage-maintenance/service";

export async function POST(request, context) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("storage_maintenance.manage");
  if (response) return response;
  const rejected = validateMutationRequest(request, user.id, requestId);
  if (rejected) return rejected;
  const parsed = await readJson(request, storageMaintenanceCleanupSchema, requestId);
  if (parsed.response) return parsed.response;
  try {
    const organizationId = resolvePermissionOrganization(user, parsed.data.organizationId);
    const data = await createStorageCleanup(
      (await context.params).id,
      { ...parsed.data, organizationId },
      user,
      requestId,
    );
    return successResponse(data, {
      status: 202,
      code: "STORAGE_CLEANUP_QUEUED",
      message: "Pembersihan file masuk antrean.",
    });
  } catch (error) {
    return handleRouteError("storage-maintenance.cleanup", error, requestId);
  }
}
