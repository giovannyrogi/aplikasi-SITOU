import { parseMultipartToPrivateTemp } from "@/lib/api/multipart";
import {
  getRequestId,
  handleRouteError,
  ServiceError,
  successResponse,
  validateMutationRequest,
} from "@/lib/api/routeHelpers";
import { requirePermission, resolvePermissionOrganization } from "@/lib/auth/permissions";
import { recoverMaintenanceItemContent } from "@/lib/storage-maintenance/service";

export async function POST(request, context) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("storage_maintenance.manage");
  if (response) return response;
  const rejected = await validateMutationRequest(request, user.id, requestId, {
    maxBytes: 11 * 1024 * 1024,
  });
  if (rejected) return rejected;
  let form = null;
  try {
    const { id, itemId } = await context.params;
    form = await parseMultipartToPrivateTemp(request);
    if (
      [...form.keys()].some((field) => !["organizationId", "file"].includes(field)) ||
      form.getAll("file").length !== 1 ||
      form.getAll("organizationId").length > 1
    )
      throw new ServiceError(
        "MULTIPART_FIELD_INVALID",
        "Formulir pemulihan harus berisi tepat satu file dan satu organisasi.",
        400,
      );
    const organizationId = resolvePermissionOrganization(
      user,
      form.get("organizationId") || null,
    );
    const data = await recoverMaintenanceItemContent(
      id,
      itemId,
      organizationId,
      form.get("file"),
      user,
      requestId,
    );
    return successResponse(data, {
      code: "STORAGE_CONTENT_RECOVERED",
      message: "Isi file berhasil dipulihkan dan diverifikasi.",
    });
  } catch (error) {
    return handleRouteError("storage-maintenance.content-recovery", error, requestId);
  } finally {
    await form?.cleanup?.();
  }
}
