import { requirePermission, resolvePermissionOrganization } from "@/lib/auth/permissions";
import {
  getRequestId,
  handleRouteError,
  readJson,
  successResponse,
  validateMutationRequest,
} from "@/lib/api/routeHelpers";
import { storageMaintenanceActionSchema } from "@/lib/storage-maintenance/schemas";
import { resolveMaintenanceItem } from "@/lib/storage-maintenance/service";

export async function POST(request, context) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("storage_maintenance.manage");
  if (response) return response;
  const rejected = await validateMutationRequest(request, user.id, requestId);
  if (rejected) return rejected;
  const parsed = await readJson(request, storageMaintenanceActionSchema, requestId);
  if (parsed.response) return parsed.response;
  try {
    const organizationId = resolvePermissionOrganization(user, parsed.data.organizationId);
    const { id, itemId } = await context.params;
    const data = await resolveMaintenanceItem(
      id,
      itemId,
      organizationId,
      parsed.data,
      user,
      requestId,
    );
    return successResponse(data, {
      code: "STORAGE_ITEM_RESOLVED",
      message: {
        retain_official: "File dipertahankan sebagai arsip resmi.",
        restore_metadata: "Status metadata file berhasil dipulihkan.",
        stage_cleanup:
          "File dipindahkan ke alur pembersihan dan akan menunggu masa aman bila diperlukan.",
        finalize_cleanup: "Catatan file yang sudah tidak memiliki byte berhasil diselesaikan.",
      }[parsed.data.action],
    });
  } catch (error) {
    return handleRouteError("storage-maintenance.resolve", error, requestId);
  }
}
