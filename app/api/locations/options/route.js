import { ROLES } from "@/app/constants/roles";
import { requireRole, resolveOrganizationAccess } from "@/app/utils/auth";
import { parsePositiveInteger } from "@/app/utils/apiValidation";
import { errorResponse, getRequestId, successResponse } from "@/lib/api/routeHelpers";
import { getLocationOptions } from "@/lib/master-data/service";

export async function GET(request) {
  const requestId = getRequestId(request);
  const { user, response } = await requireRole([ROLES.SUPERADMIN, ROLES.HRD]);
  if (response) return response;
  const parsed = parsePositiveInteger(
    new URL(request.url).searchParams.get("organizationId"),
    "ID organisasi",
  );
  if (parsed.error && user.role_code === ROLES.SUPERADMIN)
    return errorResponse("INVALID_ID", parsed.error, 400, requestId);
  const scope = resolveOrganizationAccess(user, parsed.value);
  if (scope.response) return scope.response;
  return successResponse(await getLocationOptions(scope.organizationId));
}
