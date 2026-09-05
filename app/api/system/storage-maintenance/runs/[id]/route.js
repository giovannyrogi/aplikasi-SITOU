import { requirePermission, resolvePermissionOrganization } from "@/lib/auth/permissions";
import { getRequestId, handleRouteError, successResponse } from "@/lib/api/routeHelpers";
import { getStorageMaintenanceRun } from "@/lib/storage-maintenance/service";

const positiveInteger = (value) => (/^[1-9][0-9]*$/.test(String(value)) ? String(value) : null);

export async function GET(request, context) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("storage_maintenance.manage");
  if (response) return response;
  try {
    const runId = positiveInteger((await context.params).id);
    if (!runId) throw new Error("INVALID_RUN_ID");
    const searchParams = new URL(request.url).searchParams;
    const organizationId = resolvePermissionOrganization(user, searchParams.get("organizationId"));
    const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10) || 1);
    const pageSize = Math.min(
      100,
      Math.max(10, Number.parseInt(searchParams.get("pageSize") || "10", 10) || 10),
    );
    const itemKind = ["candidate", "issue"].includes(searchParams.get("itemKind"))
      ? searchParams.get("itemKind")
      : "all";
    const result = await getStorageMaintenanceRun(runId, organizationId, {
      page,
      pageSize,
      itemKind,
    });
    return successResponse(result, { pagination: { page, pageSize, total: result.total } });
  } catch (error) {
    if (error.message === "INVALID_RUN_ID")
      return Response.json(
        { success: false, code: "INVALID_RUN_ID", message: "ID proses tidak valid.", requestId },
        { status: 400 },
      );
    return handleRouteError("storage-maintenance.run", error, requestId);
  }
}
