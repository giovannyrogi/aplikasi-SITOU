import { requirePermission, resolvePermissionOrganization } from "@/lib/auth/permissions";
import { getRequestId, handleRouteError, successResponse } from "@/lib/api/routeHelpers";
import { getEmployeeImportBatch } from "@/lib/employees/importService";

/** Menampilkan preview dan error per baris pada batch import. */
export async function GET(request, { params }) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("employee_import.read");
  if (response) return response;
  try {
    const { id } = await params;
    const organizationId = resolvePermissionOrganization(
      user,
      new URL(request.url).searchParams.get("organizationId"),
    );
    return successResponse(await getEmployeeImportBatch(id, organizationId));
  } catch (error) {
    return handleRouteError("employees.imports.detail", error, requestId);
  }
}
