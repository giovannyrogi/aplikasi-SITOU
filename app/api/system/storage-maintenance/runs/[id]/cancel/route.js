import { requirePermission, resolvePermissionOrganization } from "@/lib/auth/permissions";
import {
  getRequestId,
  handleRouteError,
  readJson,
  successResponse,
  validateMutationRequest,
} from "@/lib/api/routeHelpers";
import { storageMaintenanceCancelSchema } from "@/lib/storage-maintenance/schemas";
import { cancelStorageMaintenanceRun } from "@/lib/storage-maintenance/service";

export async function POST(request, context) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("storage_maintenance.manage");
  if (response) return response;
  const rejected = validateMutationRequest(request, user.id, requestId);
  if (rejected) return rejected;
  const parsed = await readJson(request, storageMaintenanceCancelSchema, requestId);
  if (parsed.response) return parsed.response;
  try {
    const organizationId = resolvePermissionOrganization(user, parsed.data.organizationId);
    return successResponse(
      await cancelStorageMaintenanceRun((await context.params).id, organizationId, user, requestId),
      { code: "STORAGE_RUN_CANCELLED", message: "Proses yang masih antre dibatalkan." },
    );
  } catch (error) {
    return handleRouteError("storage-maintenance.cancel", error, requestId);
  }
}
