import { requirePermission, resolvePermissionOrganization } from "@/lib/auth/permissions";
import {
  getRequestId,
  handleRouteError,
  readJson,
  successResponse,
  validateMutationRequest,
} from "@/lib/api/routeHelpers";
import { storageMaintenanceScanSchema } from "@/lib/storage-maintenance/schemas";
import { createStorageScan } from "@/lib/storage-maintenance/service";

export async function POST(request) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("storage_maintenance.manage");
  if (response) return response;
  const rejected = validateMutationRequest(request, user.id, requestId);
  if (rejected) return rejected;
  const parsed = await readJson(request, storageMaintenanceScanSchema, requestId);
  if (parsed.response) return parsed.response;
  try {
    const organizationId = resolvePermissionOrganization(user, parsed.data.organizationId);
    return successResponse(await createStorageScan(organizationId, user, requestId), {
      status: 202,
      code: "STORAGE_SCAN_QUEUED",
      message: "Pemeriksaan penyimpanan masuk antrean.",
    });
  } catch (error) {
    return handleRouteError("storage-maintenance.scan", error, requestId);
  }
}
