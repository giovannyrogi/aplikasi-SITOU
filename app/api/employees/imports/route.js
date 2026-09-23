import { parseMultipartToPrivateTemp } from "@/lib/api/multipart";
import { requirePermission, resolvePermissionOrganization } from "@/lib/auth/permissions";
import {
  getRequestId,
  handleRouteError,
  ServiceError,
  successResponse,
  validateMutationRequest,
} from "@/lib/api/routeHelpers";
import { createEmployeeImport } from "@/lib/employees/importService";

/** Mengunggah, mem-parse, dan memvalidasi workbook menjadi preview batch. */
export async function POST(request) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("employee_import.manage");
  if (response) return response;
  const rejected = await validateMutationRequest(request, user.id, requestId, {
    maxBytes: 11 * 1024 * 1024,
  });
  if (rejected) return rejected;
  let form = null;
  try {
    form = await parseMultipartToPrivateTemp(request);
    if (
      [...form.keys()].some((field) => !["organizationId", "file"].includes(field)) ||
      form.getAll("file").length !== 1 ||
      form.getAll("organizationId").length > 1
    )
      throw new ServiceError(
        "MULTIPART_FIELD_INVALID",
        "Bagian formulir import tidak lengkap atau mengandung field yang tidak diizinkan.",
        400,
      );
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
  } finally {
    await form?.cleanup?.();
  }
}
