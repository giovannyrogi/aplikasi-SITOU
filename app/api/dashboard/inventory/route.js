import { z } from "zod";
import { requireAuthenticatedUser } from "@/app/utils/auth";
import { resolvePermissionOrganization } from "@/lib/auth/permissions";
import { getInventoryDashboard } from "@/lib/dashboard/workspaceService";
import { getRequestId, handleRouteError, successResponse, errorResponse } from "@/lib/api/routeHelpers";

const filters = z.object({ trendPeriod: z.enum(["year", "month", "week"], { message: "Pilih periode grafik yang tersedia." }).optional(), organizationId: z.string().regex(/^[1-9]\d*$/, "Pilih organisasi yang valid.").optional(),
  warehouseId: z.string().regex(/^[1-9]\d*$/, "Pilih gudang yang valid.").optional() }).strict();
export async function GET(request) {
  const requestId = getRequestId(request);
  const { user, response } = await requireAuthenticatedUser();
  if (response) return response;
  try {
    const parsed = filters.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success) return errorResponse("VALIDATION_ERROR", "Periksa pilihan gudang atau organisasi.", 400, requestId,
      Object.fromEntries(parsed.error.issues.map((issue) => [issue.path.join("."), issue.message])));
    const organizationId = resolvePermissionOrganization(user, parsed.data.organizationId);
    return successResponse(await getInventoryDashboard(user, organizationId, parsed.data.warehouseId, requestId, parsed.data.trendPeriod));
  } catch (error) { return handleRouteError("dashboard.inventory", error, requestId); }
}
