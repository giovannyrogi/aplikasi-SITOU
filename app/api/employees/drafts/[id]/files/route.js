import { parseMultipartToPrivateTemp } from "@/lib/api/multipart";
import { parsePositiveInteger } from "@/app/utils/apiValidation";
import { requirePermission, resolvePermissionOrganization } from "@/lib/auth/permissions";
import {
  errorResponse,
  getRequestId,
  handleRouteError,
  ServiceError,
  successResponse,
  validateMutationRequest,
} from "@/lib/api/routeHelpers";
import { storeEmployeeDraftFile } from "@/lib/files/storage";

const MAX_REQUEST_BYTES = 11 * 1024 * 1024;

/** Mengunggah gambar profil/ijazah atau PDF kontrak/SK ke staging privat milik draft. */
export async function POST(request, { params }) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("private_files.manage");
  if (response) return response;
  const rejected = await validateMutationRequest(request, user.id, requestId, {
    maxBytes: MAX_REQUEST_BYTES,
  });
  if (rejected) return rejected;
  const id = parsePositiveInteger((await params).id, "ID draft");
  if (id.error) return errorResponse("INVALID_ID", id.error, 400, requestId);
  let form = null;
  try {
    form = await parseMultipartToPrivateTemp(request);
    const allowedFields = new Set(["organizationId", "file", "fileKind", "draftSlot"]);
    if (
      [...form.keys()].some((field) => !allowedFields.has(field)) ||
      form.getAll("file").length !== 1 ||
      form.getAll("organizationId").length > 1 ||
      form.getAll("fileKind").length !== 1 ||
      form.getAll("draftSlot").length > 1
    )
      throw new ServiceError(
        "MULTIPART_FIELD_INVALID",
        "Bagian formulir file draft tidak lengkap atau mengandung field yang tidak diizinkan.",
        400,
      );
    const organizationId = resolvePermissionOrganization(user, form.get("organizationId"));
    const data = await storeEmployeeDraftFile({
      file: form.get("file"),
      fileKind: String(form.get("fileKind") || ""),
      draftSlot: String(form.get("draftSlot") || "") || undefined,
      draftId: id.value,
      organizationId,
      actor: user,
      requestId,
    });
    return successResponse(data, {
      status: 201,
      code: "DRAFT_FILE_UPLOADED",
      message: "Dokumen draft berhasil diunggah.",
    });
  } catch (error) {
    return handleRouteError("employee-drafts.files.upload", error, requestId);
  } finally {
    await form?.cleanup?.();
  }
}
