import { requirePermission, resolvePermissionOrganization } from "@/lib/auth/permissions";
import { getRequestId, handleRouteError } from "@/lib/api/routeHelpers";
import { createEmployeeImportTemplate } from "@/lib/employees/importService";

/** Mengunduh template resmi agar struktur kolom selalu selaras dengan parser. */
export async function GET(request) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("employee_import.read");
  if (response) return response;
  try {
    const organizationId = resolvePermissionOrganization(
      user,
      new URL(request.url).searchParams.get("organizationId"),
    );
    return new Response(await createEmployeeImportTemplate(organizationId), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="data-pegawai.xlsx"',
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return handleRouteError("employees.imports.template", error, requestId);
  }
}
