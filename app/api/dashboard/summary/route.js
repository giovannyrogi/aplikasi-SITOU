import { ROLES } from "@/app/constants/roles";
import { requireRole } from "@/app/utils/auth";
import { getRequestId, handleRouteError, successResponse } from "@/lib/api/routeHelpers";
import { getDashboardSummary } from "@/lib/dashboard/service";

/** Menyajikan ringkasan dashboard sesuai role dan organisasi yang telah diverifikasi server. */
export async function GET(request) {
  const requestId = getRequestId(request);
  const { user, response } = await requireRole([ROLES.SUPERADMIN, ROLES.HRD, ROLES.LEADER]);
  if (response) return response;
  try {
    const url = new URL(request.url);
    const result = await getDashboardSummary({
      actor: user,
      requestedOrganizationId: url.searchParams.get("organizationId"),
      requestedStartDate: url.searchParams.get("startDate"),
      requestedEndDate: url.searchParams.get("endDate"),
    });
    return successResponse(result);
  } catch (error) {
    return handleRouteError("dashboard.summary", error, requestId);
  }
}
