import { ROLES } from "@/app/constants/roles";
import { requireRole, resolveOrganizationAccess } from "@/app/utils/auth";
import { parsePositiveInteger } from "@/app/utils/apiValidation";
import { errorResponse, getRequestId, successResponse } from "@/lib/api/routeHelpers";
import { getOrganizationUnitOptions } from "@/lib/master-data/organizationStructureService";

/** Menyediakan pilihan parent unit yang telah dibatasi ke organisasi session. */
export async function GET(request) {
  const requestId = getRequestId(request);
  const { user, response } = await requireRole([ROLES.SUPERADMIN, ROLES.HRD]);
  if (response) return response;
  const rawOrganizationId = new URL(request.url).searchParams.get("organizationId");
  const parsed = rawOrganizationId
    ? parsePositiveInteger(rawOrganizationId, "ID organisasi")
    : { value: null, error: null };
  if (parsed.error) return errorResponse("INVALID_ID", parsed.error, 400, requestId);
  const scope = resolveOrganizationAccess(user, parsed.value);
  if (scope.response) return scope.response;
  return successResponse(await getOrganizationUnitOptions(scope.organizationId));
}
