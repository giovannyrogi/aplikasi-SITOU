import { parsePositiveInteger } from "@/app/utils/apiValidation";
import { requirePermission, resolvePermissionOrganization } from "@/lib/auth/permissions";
import {
  errorResponse,
  getRequestId,
  handleRouteError,
  successResponse,
} from "@/lib/api/routeHelpers";
import { storeEmployeeDraftFile } from "@/lib/files/storage";

const MAX_REQUEST_BYTES = 11 * 1024 * 1024;

/** Mengunggah pas foto, KTP, PDF kontrak, atau SK ke staging privat milik draft. */
export async function POST(request, { params }) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("private_files.manage");
  if (response) return response;
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return errorResponse("INVALID_ORIGIN", "Asal permintaan tidak diizinkan.", 403, requestId);
  if (Number(request.headers.get("content-length") || 0) > MAX_REQUEST_BYTES)
    return errorResponse("PAYLOAD_TOO_LARGE", "Ukuran upload maksimal 10 MB.", 413, requestId);
  const id = parsePositiveInteger((await params).id, "ID draft");
  if (id.error) return errorResponse("INVALID_ID", id.error, 400, requestId);
  try {
    const form = await request.formData();
    const organizationId = resolvePermissionOrganization(user, form.get("organizationId"));
    const data = await storeEmployeeDraftFile({
      file: form.get("file"),
      fileKind: String(form.get("fileKind") || ""),
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
  }
}
