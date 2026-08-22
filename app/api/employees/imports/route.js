import { requirePermission, resolvePermissionOrganization } from "@/lib/auth/permissions";
import {
  errorResponse,
  getRequestId,
  handleRouteError,
  successResponse,
} from "@/lib/api/routeHelpers";
import { createEmployeeImport } from "@/lib/employees/importService";

/** Mengunggah, mem-parse, dan memvalidasi workbook menjadi preview batch. */
export async function POST(request) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("employee_import.manage");
  if (response) return response;
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return errorResponse("INVALID_ORIGIN", "Asal permintaan tidak diizinkan.", 403, requestId);
  if (Number(request.headers.get("content-length") || 0) > 11 * 1024 * 1024)
    return errorResponse("PAYLOAD_TOO_LARGE", "File Excel maksimal 10 MB.", 413, requestId);
  try {
    const form = await request.formData();
    const organizationId = resolvePermissionOrganization(user, form.get("organizationId") || null);
    const data = await createEmployeeImport({
      file: form.get("file"),
      organizationId,
      actor: user,
      requestId,
    });
    return successResponse(data, {
      status: 201,
      code: "IMPORT_VALIDATED",
      message: "File selesai divalidasi. Periksa setiap pegawai sebelum mengimpor.",
    });
  } catch (error) {
    return handleRouteError("employees.imports.create", error, requestId);
  }
}
