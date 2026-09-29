import { requirePermission, resolvePermissionOrganization } from "@/lib/auth/permissions";
import {
  getRequestId,
  handleRouteError,
  readJson,
  successResponse,
  validateMutationRequest,
} from "@/lib/api/routeHelpers";
import { storageMaintenanceQuarantineSchema } from "@/lib/storage-maintenance/schemas";
import { quarantineMaintenanceItem } from "@/lib/storage-maintenance/service";

export async function POST(request, context) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("storage_maintenance.manage");
  if (response) return response;
  const rejected = await validateMutationRequest(request, user.id, requestId);
  if (rejected) return rejected;
  const parsed = await readJson(request, storageMaintenanceQuarantineSchema, requestId);
  if (parsed.response) return parsed.response;
  try {
    const organizationId = resolvePermissionOrganization(user, parsed.data.organizationId);
    const { id, itemId } = await context.params;
    const data = await quarantineMaintenanceItem(id, itemId, organizationId, user, requestId);
    return successResponse(data, {
      code: "FILE_QUARANTINED",
      message: "File dipindahkan ke karantina selama tujuh hari.",
    });
  } catch (error) {
    return handleRouteError("storage-maintenance.quarantine", error, requestId);
  }
}
