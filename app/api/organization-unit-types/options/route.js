import { ROLES } from "@/app/constants/roles";
import { requireRole, resolveOrganizationAccess } from "@/app/utils/auth";
import { parsePositiveInteger } from "@/app/utils/apiValidation";
import {
  errorResponse,
  getRequestId,
  handleRouteError,
  successResponse,
} from "@/lib/api/routeHelpers";
import { getOrganizationUnitTypeOptions } from "@/lib/master-data/organizationUnitTypeService";

/** Menyediakan pilihan aktif dan pilihan lama untuk form edit Divisi & Unit. */
export async function GET(request) {
  const requestId = getRequestId(request);
  const { user, response } = await requireRole([ROLES.SUPERADMIN, ROLES.HRD]);
  if (response) return response;
  try {
    const params = new URL(request.url).searchParams;
    const rawOrganizationId = params.get("organizationId");
    const parsedOrganization = rawOrganizationId
      ? parsePositiveInteger(rawOrganizationId, "ID organisasi")
      : { value: null, error: "Organisasi wajib dipilih." };
    if (parsedOrganization.error)
      return errorResponse("INVALID_ID", parsedOrganization.error, 400, requestId);
    const rawIncludeId = params.get("includeId");
    const parsedInclude = rawIncludeId
      ? parsePositiveInteger(rawIncludeId, "ID jenis unit")
      : { value: null, error: null };
    if (parsedInclude.error)
      return errorResponse("INVALID_ID", parsedInclude.error, 400, requestId);
    const scope = resolveOrganizationAccess(user, parsedOrganization.value);
    if (scope.response) return scope.response;
    return successResponse(
      await getOrganizationUnitTypeOptions(scope.organizationId, parsedInclude.value),
    );
  } catch (error) {
    return handleRouteError("organization-unit-types.options", error, requestId);
  }
}
