import pool from "@/lib/dbConfig";
import { requirePermission, resolvePermissionOrganization } from "@/lib/auth/permissions";
import {
  errorResponse,
  getRequestId,
  handleRouteError,
  parseListQuery,
  validateMutationRequest,
} from "@/lib/api/routeHelpers";
import { writeAudit } from "@/lib/audit";
import { parseEmployeeListFilters } from "@/lib/employees/schemas";
import { readEmployeeExport } from "@/lib/employees/exportService";
import { buildEmployeeExportWorkbook } from "@/lib/employees/exportWorkbook.mjs";

/** Export sensitif memakai filter, organisasi, dan scope lokasi yang sama dengan daftar pegawai. */
export async function GET(request) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("employees.export_sensitive");
  if (response) return response;
  const limited = await validateMutationRequest(request, user.id, requestId, {
    windowMs: 5 * 60 * 1000,
    maxRequests: 5,
    rateLimitAction: "employees.export",
    rateLimitMessage:
      "Batas 5 export dalam 5 menit telah tercapai. Coba kembali setelah masa tunggu berakhir.",
  });
  if (limited) return limited;

  try {
    const url = new URL(request.url);
    const parsedFilters = parseEmployeeListFilters(url.searchParams);
    if (!parsedFilters.success)
      return errorResponse("VALIDATION_ERROR", "Filter pegawai tidak valid.", 400, requestId);
    const organizationId = resolvePermissionOrganization(user, parsedFilters.data.organizationId);
    const { search } = parseListQuery(url.searchParams);
    const report = await readEmployeeExport({
      filters: parsedFilters.data,
      search,
      organizationId,
      actor: user,
    });
    const buffer = await buildEmployeeExportWorkbook(report);
    const auditedFilters = { ...parsedFilters.data };
    delete auditedFilters.organizationId;
    await writeAudit(pool, {
      organizationId,
      actorUserId: user.id,
      action: "employee.export_sensitive",
      entityType: "employee_export",
      entityId: report.asOf,
      afterData: {
        filters: { ...auditedFilters, searchApplied: Boolean(search) },
        employeeCount: report.employees.length,
        detailRowCount: report.detailRowCount,
        sheetRowCounts: report.sheetRowCounts,
      },
      requestId,
    });
    return new Response(buffer, {
      headers: {
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="sitou-data-pegawai-${report.asOf}.xlsx"`,
      },
    });
  } catch (error) {
    const failed = handleRouteError("employees.export", error, requestId);
    failed.headers.set("Cache-Control", "private, no-store");
    return failed;
  }
}
