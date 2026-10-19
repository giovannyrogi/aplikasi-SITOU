import { dashboardActivityHistoryQuerySchema } from "@/lib/dashboard/activityHistorySchema.mjs";
import { requireRole } from "@/app/utils/auth";
import { ROLES } from "@/app/constants/roles";
import {
  getRequestId,
  handleRouteError,
  successResponse,
  ServiceError,
} from "@/lib/api/routeHelpers";
import { readDashboardActivityHistory } from "@/lib/dashboard/activityHistory";

export async function GET(request) {
  const requestId = getRequestId(request);
  const { user, response } = await requireRole([ROLES.HRD]);
  if (response) return response;
  try {
    const query = new URL(request.url).searchParams;
    const parsed = dashboardActivityHistoryQuerySchema.safeParse(Object.fromEntries(query));
    if (!parsed.success || [...query.keys()].some((key) => query.getAll(key).length > 1))
      throw new ServiceError("VALIDATION_ERROR", "Filter aktivitas tidak valid.", 400);
    return successResponse(
      await readDashboardActivityHistory(
        user,
        parsed.data.cursor,
        undefined,
        Number(parsed.data.pageSize),
      ),
    );
  } catch (error) {
    return handleRouteError("dashboard.activities", error, requestId);
  }
}
