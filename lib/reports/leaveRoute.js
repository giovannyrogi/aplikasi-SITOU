import pool from "@/lib/dbConfig";
import { requirePermission } from "@/lib/auth/permissions";
import { getRequestId, handleRouteError, validateMutationRequest } from "@/lib/api/routeHelpers";
import { writeAudit } from "@/lib/audit";
import { getReportContext } from "./service";
import { readLeaveReport } from "./leaveService";
import { buildLeaveReportWorkbook } from "./leaveWorkbook.mjs";

export async function handleLeaveReportRequest(request, exportAll = false) {
  const requestId = getRequestId(request);
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  try {
    const { user, response } = await requirePermission("leave_requests.read");
    if (response) return response;
    if (exportAll) {
      const denied = await validateMutationRequest(request, user.id, requestId);
      if (denied) return denied;
    }
    const input = Object.fromEntries(
      [...new URL(request.url).searchParams].filter(([, value]) => value !== ""),
    );
    const context = await getReportContext(user, input.organizationId);
    const report = await readLeaveReport(input, context, { exportAll });
    if (!exportAll) return Response.json({ success: true, data: report }, { headers });
    const buffer = await buildLeaveReportWorkbook(report);
    await writeAudit(pool, {
      organizationId: context.organizationId,
      actorUserId: user.id,
      action: "report.export",
      entityType: "report",
      entityId: "leave-summary",
      afterData: {
        year: report.filters.year,
        rows: report.total,
        approved: report.summary.approved,
      },
      requestId,
    });
    return new Response(buffer, {
      headers: {
        ...headers,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="sitou-rekap-cuti-izin-${report.filters.year}.xlsx"`,
      },
    });
  } catch (error) {
    const response = handleRouteError("reports.leave-summary", error, requestId);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
}
