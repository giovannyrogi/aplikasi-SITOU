import { requirePermission, resolvePermissionOrganization } from "@/lib/auth/permissions";
import { getRequestId, handleRouteError, readJson, successResponse, validateMutationRequest } from "@/lib/api/routeHelpers";
import { storageMaintenanceQuarantineSchema } from "@/lib/storage-maintenance/schemas";
import { restoreQuarantineItem } from "@/lib/storage-maintenance/service";

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
    const data = await restoreQuarantineItem((await context.params).id, organizationId, user, requestId);
    return successResponse(data, { code: "QUARANTINE_RESTORED", message: "File berhasil dipulihkan dari karantina." });
  } catch (error) {
    return handleRouteError("storage-maintenance.quarantine-restore", error, requestId);
  }
}
