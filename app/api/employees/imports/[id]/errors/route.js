import { requirePermission, resolvePermissionOrganization } from "@/lib/auth/permissions";
import { getRequestId, handleRouteError } from "@/lib/api/routeHelpers";
import { createEmployeeImportErrorReport } from "@/lib/employees/importService";

/** Mengunduh error terstruktur agar koreksi data massal dapat dilakukan di Excel. */
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
    return new Response(await createEmployeeImportErrorReport(id, organizationId), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="kesalahan-import-pegawai-${id}.xlsx"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return handleRouteError("employees.imports.errors", error, requestId);
  }
}
