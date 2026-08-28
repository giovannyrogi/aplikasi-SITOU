import {
  requirePermission,
  resolvePermissionOrganization,
  ensureActorEmployeeAccess,
} from "@/lib/auth/permissions";
import {
  errorResponse,
  getRequestId,
  handleRouteError,
  successResponse,
  validateMutationRequest,
} from "@/lib/api/routeHelpers";
import { listEmployeeFiles, storeEmployeeFile } from "@/lib/files/storage";

const MAX_REQUEST_BYTES = 11 * 1024 * 1024;

/** Mengembalikan metadata file pegawai; isi file tetap diakses melalui route file ID. */
export async function GET(request) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("private_files.read_sensitive");
  if (response) return response;
  try {
    const searchParams = new URL(request.url).searchParams;
    const organizationId = resolvePermissionOrganization(user, searchParams.get("organizationId"));
    const employeeId = searchParams.get("employeeId");
    if (!/^\d+$/.test(employeeId || ""))
      return errorResponse("EMPLOYEE_REQUIRED", "Pegawai wajib dipilih.", 400, requestId);
    await ensureActorEmployeeAccess(user, employeeId, organizationId);
    return successResponse(await listEmployeeFiles(employeeId, organizationId));
  } catch (error) {
    return handleRouteError("uploads.list", error, requestId);
  }
}

/** Menyimpan file pegawai privat dan hanya mengembalikan ID metadata. */
export async function POST(request) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("private_files.manage");
  if (response) return response;
  const rejected = validateMutationRequest(request, user.id, requestId, {
    maxBytes: MAX_REQUEST_BYTES,
  });
  if (rejected) return rejected;
  try {
    const form = await request.formData();
    const organizationId = resolvePermissionOrganization(user, form.get("organizationId") || null);
    const employeeId = String(form.get("employeeId") || "");
    await ensureActorEmployeeAccess(user, employeeId, organizationId);
    const data = await storeEmployeeFile({
      file: form.get("file"),
      fileKind: String(form.get("fileKind") || ""),
      employeeId,
      organizationId,
      actor: user,
      requestId,
    });
    return successResponse(data, {
      status: 201,
      code: "FILE_UPLOADED",
      message: "File berhasil diunggah.",
    });
  } catch (error) {
    return handleRouteError("uploads.create", error, requestId);
  }
}
