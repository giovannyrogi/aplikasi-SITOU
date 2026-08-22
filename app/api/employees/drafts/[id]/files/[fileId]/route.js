import { parsePositiveInteger } from "@/app/utils/apiValidation";
import { requirePermission, resolvePermissionOrganization } from "@/lib/auth/permissions";
import {
  errorResponse,
  getRequestId,
  handleRouteError,
  successResponse,
  validateMutationRequest,
} from "@/lib/api/routeHelpers";
import { softDeleteDraftFile } from "@/lib/files/storage";

/** Menghapus pilihan dokumen staging tanpa menerima object key dari browser. */
export async function DELETE(request, { params }) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("private_files.manage");
  if (response) return response;
  const rejected = validateMutationRequest(request, user.id, requestId);
  if (rejected) return rejected;
  const resolved = await params;
  const draftId = parsePositiveInteger(resolved.id, "ID draft");
  const fileId = parsePositiveInteger(resolved.fileId, "ID file");
  if (draftId.error || fileId.error)
    return errorResponse("INVALID_ID", draftId.error || fileId.error, 400, requestId);
  try {
    const organizationId = resolvePermissionOrganization(
      user,
      new URL(request.url).searchParams.get("organizationId"),
    );
    await softDeleteDraftFile(fileId.value, draftId.value, organizationId, user, requestId);
    return successResponse(null, { code: "DRAFT_FILE_DELETED", message: "Dokumen dihapus." });
  } catch (error) {
    return handleRouteError("employee-drafts.files.delete", error, requestId);
  }
}
