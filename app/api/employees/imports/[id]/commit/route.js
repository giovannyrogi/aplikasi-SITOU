import { requirePermission, resolvePermissionOrganization } from "@/lib/auth/permissions";
import {
  getRequestId,
  handleRouteError,
  successResponse,
  validateMutationRequest,
} from "@/lib/api/routeHelpers";
import { commitEmployeeImport } from "@/lib/employees/importService";

/** Commit idempotent hanya memasukkan baris yang lolos validasi. */
export async function POST(request, { params }) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("employee_import.manage");
  if (response) return response;
  const rejected = validateMutationRequest(request, user.id, requestId);
  if (rejected) return rejected;
  try {
    const { id } = await params;
    const organizationId = resolvePermissionOrganization(
      user,
      new URL(request.url).searchParams.get("organizationId"),
    );
    const data = await commitEmployeeImport(id, organizationId, user, requestId);
    return successResponse(data, {
      code: "IMPORT_COMMITTED",
      message: "Data pegawai valid berhasil diimpor.",
    });
  } catch (error) {
    return handleRouteError("employees.imports.commit", error, requestId);
  }
}
