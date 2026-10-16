import { requireAuthenticatedUser } from "@/app/utils/auth";
import { getEmployeeDashboard } from "@/lib/dashboard/workspaceService";
import { getRequestId, handleRouteError, successResponse, errorResponse } from "@/lib/api/routeHelpers";

export async function GET(request) {
  const requestId = getRequestId(request);
  const { user, response } = await requireAuthenticatedUser();
  if (response) return response;
  if ([...new URL(request.url).searchParams.keys()].length)
    return errorResponse("VALIDATION_ERROR", "Dashboard memakai profil akun yang login.", 400, requestId, { employeeId: "Profil tidak dapat dipilih." });
  try { return successResponse(await getEmployeeDashboard(user)); }
  catch (error) { return handleRouteError("dashboard.employee_self", error, requestId); }
}
