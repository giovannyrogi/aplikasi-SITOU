import pool from "@/lib/dbConfig";
import { requirePermission } from "@/lib/auth/permissions";
import { getRequestId, handleRouteError, validateMutationRequest } from "@/lib/api/routeHelpers";
import { writeAudit } from "@/lib/audit";
import { getReportContext } from "./service";
import { readDisciplinaryReport } from "./disciplinaryService";
import { buildDisciplinaryReportWorkbook } from "./disciplinaryWorkbook.mjs";

/** Daftar dan ekspor memakai service serta batas organisasi/scope yang sama. */
export async function handleDisciplinaryReportRequest(request, exportAll = false) {
  const requestId = getRequestId(request);
  try {
    const employeePermission = await requirePermission("employees.read");
    if (employeePermission.response) return employeePermission.response;
    const disciplinePermission = await requirePermission("discipline.read");
    if (disciplinePermission.response) return disciplinePermission.response;
    const user = employeePermission.user;
    if (exportAll) {
      const denied = await validateMutationRequest(request, user.id, requestId);
      if (denied) return denied;
    }
    const input = Object.fromEntries(
      [...new URL(request.url).searchParams].filter(([, value]) => value !== ""),
    );
    const context = await getReportContext(user, input.organizationId);
    const report = await readDisciplinaryReport(input, context, { exportAll });
    const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
    if (!exportAll) {
      return Response.json({ success: true, data: report }, { headers });
    }
    report.filterLabels = {};
    for (const [key, table] of [
      ["locationId", "locations"],
      ["organizationUnitId", "organization_units"],
      ["positionId", "positions"],
      ["actionTypeId", "disciplinary_action_types"],
    ]) {
      if (!report.filters[key]) continue;
      const result = await pool.query(
        `SELECT name FROM ${table} WHERE organization_id=$1 AND id=$2`,
        [context.organizationId, report.filters[key]],
      );
      report.filterLabels[key] = result.rows[0]?.name || "Pilihan tidak tersedia";
    }
    const buffer = await buildDisciplinaryReportWorkbook(report);
    await writeAudit(pool, {
      organizationId: context.organizationId,
      actorUserId: user.id,
      action: "report.export",
      entityType: "report",
      entityId: "disciplinary-actions",
      afterData: {
        employees: report.total,
        matchedActions: report.totalMatchedActions,
        asOf: report.asOf,
        startDate: report.filters.startDate,
        endDate: report.filters.endDate,
      },
      requestId,
    });
    return new Response(buffer, {
      headers: {
        ...headers,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="sitou-disciplinary-actions-${report.asOf}.xlsx"`,
      },
    });
  } catch (error) {
    const response = handleRouteError("reports.disciplinary-actions", error, requestId);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
}
