import pool from "@/lib/dbConfig";
import { requirePermission, resolvePermissionOrganization } from "@/lib/auth/permissions";
import {
  getRequestId,
  successResponse,
  errorResponse,
  handleRouteError,
  validateMutationRequest,
} from "@/lib/api/routeHelpers";
import { writeAudit } from "@/lib/audit";
import { stockReportSchema } from "@/lib/inventory/stockReportPolicy.mjs";
import { stockReport } from "@/lib/inventory/stockReportService";
import { stockReportWorkbook } from "@/lib/inventory/stockReportExport.mjs";
export async function GET(request) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("inventory.reports.read");
  if (response) return response;
  try {
    const params = Object.fromEntries(new URL(request.url).searchParams);
    const exportAll = params.export === "xlsx",
      options = params.options === "1",
      detail = params.action === "history";
    if (
      (params.export && !exportAll) ||
      (params.options && !options) ||
      (params.action && !detail) ||
      Number(exportAll) + Number(options) + Number(detail) > 1
    )
      return errorResponse("VALIDATION_ERROR", "Pilihan laporan tidak valid.", 400, requestId);
    delete params.export;
    delete params.options;
    delete params.action;
    params.organizationId = resolvePermissionOrganization(user, params.organizationId);
    const parsed = stockReportSchema.safeParse(params);
    if (!parsed.success)
      return errorResponse(
        "VALIDATION_ERROR",
        "Periksa periode dan filter laporan stok.",
        400,
        requestId,
        Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message])),
      );
    if (exportAll) {
      const rejected = await validateMutationRequest(request, user.id, requestId, {
        maxRequests: 5,
        windowMs: 300000,
        rateLimitAction: "inventory.stock_report.export",
        rateLimitMessage:
          "Batas 5 ekspor dalam 5 menit tercapai. Coba lagi setelah masa tunggu berakhir.",
      });
      if (rejected) return rejected;
    }
    const result = await stockReport(parsed.data, user, { options, detail, exportAll });
    const buffer = exportAll ? await stockReportWorkbook(result) : null;
    if (exportAll || user.role_code === "superadmin")
      await writeAudit(pool, {
        organizationId: params.organizationId,
        actorUserId: user.id,
        action: exportAll ? "inventory.stock_report.export" : "inventory.stock_report.read",
        entityType: "inventory_stock_report",
        entityId: result.filters?.to || "options",
        afterData: { filters: result.filters || parsed.data, rowCount: result.data?.length },
        requestId,
      });
    if (!exportAll) return successResponse(result);
    const code =
      result.organization.code.replace(/[^a-zA-Z0-9_-]/g, "_") || String(params.organizationId);
    return new Response(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="sitou-stok-${code}-${result.filters.from}-${result.filters.to}.xlsx"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return handleRouteError("inventory.stock_report", error, requestId);
  }
}
