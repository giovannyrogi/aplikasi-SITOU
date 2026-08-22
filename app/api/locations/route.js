import { ROLES } from "@/app/constants/roles";
import { requireRole, resolveOrganizationAccess } from "@/app/utils/auth";
import { parsePositiveInteger } from "@/app/utils/apiValidation";
import {
  errorResponse,
  getRequestId,
  handleRouteError,
  parseListQuery,
  readJson,
  successResponse,
  validateMutationRequest,
} from "@/lib/api/routeHelpers";
import { locationSchema } from "@/lib/master-data/schemas";
import { createLocation, listLocations } from "@/lib/master-data/service";

export async function GET(request) {
  const requestId = getRequestId(request);
  const { user, response } = await requireRole([ROLES.SUPERADMIN, ROLES.HRD]);
  if (response) return response;
  try {
    const url = new URL(request.url);
    const query = parseListQuery(url.searchParams);
    const organization = url.searchParams.get("organizationId");
    const parsedOrganization = organization
      ? parsePositiveInteger(organization, "ID organisasi")
      : { value: null, error: null };
    if (parsedOrganization.error)
      return errorResponse("INVALID_ID", parsedOrganization.error, 400, requestId);
    const scope = resolveOrganizationAccess(user, parsedOrganization.value, { optional: true });
    if (scope.response) return scope.response;
    query.organizationId = scope.organizationId;
    const result = await listLocations(query);
    return successResponse(result.data, {
      pagination: { page: query.page, pageSize: query.pageSize, total: result.total },
    });
  } catch (error) {
    return handleRouteError("locations.list", error, requestId);
  }
}

export async function POST(request) {
  const requestId = getRequestId(request);
  const { user, response } = await requireRole([ROLES.SUPERADMIN, ROLES.HRD]);
  if (response) return response;
  const rejected = validateMutationRequest(request, user.id, requestId);
  if (rejected) return rejected;
  const parsed = await readJson(request, locationSchema, requestId);
  if (parsed.response) return parsed.response;
  const scope = resolveOrganizationAccess(user, parsed.data.organizationId);
  if (scope.response) return scope.response;
  try {
    return successResponse(
      await createLocation(
        { ...parsed.data, organizationId: scope.organizationId },
        user,
        requestId,
      ),
      {
        status: 201,
        code: "LOCATION_CREATED",
        message: "Lokasi berhasil dibuat.",
      },
    );
  } catch (error) {
    return handleRouteError("locations.create", error, requestId);
  }
}
