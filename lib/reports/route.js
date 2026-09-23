import pool from "@/lib/dbConfig";
import { requirePermission } from "@/lib/auth/permissions";
import { getRequestId, handleRouteError, validateMutationRequest } from "@/lib/api/routeHelpers";
import { writeAudit } from "@/lib/audit";
import { getReportContext, readReport } from "./service";
import { buildReportWorkbook } from "./workbook.mjs";

/** Daftar dan ekspor melewati guard yang sama; ekspor tidak memperluas cakupan data. */
export async function handleReportRequest(request, kind, exportAll = false) {
  const requestId = getRequestId(request);
  try {
    const { user, response } = await requirePermission("employees.read");
    if (response) return response;
    if (kind === "expiring-contracts") {
      const permission = await requirePermission("contracts.read");
      if (permission.response) return permission.response;
    }
    if (exportAll) {
      const denied = await validateMutationRequest(request, user.id, requestId);
      if (denied) return denied;
    }
    const input = Object.fromEntries(
      [...new URL(request.url).searchParams].filter(([, value]) => value !== ""),
    );
    const context = await getReportContext(user, input.organizationId);
    const report = await readReport(kind, input, context, { exportAll });
    const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
    if (!exportAll) {
      if (user.role_code === "superadmin")
        await writeAudit(pool, {
          organizationId: context.organizationId,
          actorUserId: user.id,
          action: "report.view",
          entityType: "report",
          entityId: kind,
          afterData: { rows: report.total, asOf: report.asOf, group: report.filters.group },
          requestId,
        });
      return Response.json({ success: true, data: report }, { headers });
    }
    // Label filter diambil per organisasi; tidak memuat profil lengkap untuk ekspor.
    report.filterLabels = {};
    for (const [key, table] of [
      ["locationId", "locations"],
      ["organizationUnitId", "organization_units"],
      ["positionId", "positions"],
      ["employmentTypeId", "employment_types"],
    ]) {
      if (!report.filters[key]) continue;
      const result = await pool.query(
        `SELECT name FROM ${table} WHERE organization_id=$1 AND id=$2`,
        [context.organizationId, report.filters[key]],
      );
      report.filterLabels[key] = result.rows[0]?.name || "Pilihan tidak tersedia";
    }
    const buffer = await buildReportWorkbook(kind, report);
    await writeAudit(pool, {
      organizationId: context.organizationId,
      actorUserId: user.id,
      action: "report.export",
      entityType: "report",
      entityId: kind,
      afterData: {
        rows: report.total,
        asOf: report.asOf,
        group: report.filters.group,
        startDate: report.filters.startDate,
        endDate: report.filters.endDate,
      },
      requestId,
    });
    return new Response(buffer, {
      headers: {
        ...headers,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="sitou-${kind}-${report.asOf}.xlsx"`,
      },
    });
  } catch (error) {
    const response = handleRouteError(`reports.${kind}`, error, requestId);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
}
