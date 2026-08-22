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
import { organizationUnitCreateSchema } from "@/lib/master-data/schemas";
import {
  createOrganizationUnit,
  listOrganizationUnits,
} from "@/lib/master-data/organizationStructureService";

/** Menampilkan Divisi & Unit lintas organisasi untuk Superadmin atau satu organisasi untuk HRD. */
export async function GET(request) {
  const requestId = getRequestId(request);
  const { user, response } = await requireRole([ROLES.SUPERADMIN, ROLES.HRD]);
  if (response) return response;

  try {
    const url = new URL(request.url);
    const query = parseListQuery(url.searchParams);
    const rawOrganizationId = url.searchParams.get("organizationId");
    const parsedOrganization = rawOrganizationId
      ? parsePositiveInteger(rawOrganizationId, "ID organisasi")
      : { value: null, error: null };
    if (parsedOrganization.error)
      return errorResponse("INVALID_ID", parsedOrganization.error, 400, requestId);
    const scope = resolveOrganizationAccess(user, parsedOrganization.value, { optional: true });
    if (scope.response) return scope.response;
    const result = await listOrganizationUnits({ ...query, organizationId: scope.organizationId });
    return successResponse(result.data, {
      pagination: { page: query.page, pageSize: query.pageSize, total: result.total },
    });
  } catch (error) {
    return handleRouteError("organization-units.list", error, requestId);
  }
}

/** Membuat unit pada organisasi yang sudah dikunci oleh session server. */
export async function POST(request) {
  const requestId = getRequestId(request);
  const { user, response } = await requireRole([ROLES.SUPERADMIN, ROLES.HRD]);
  if (response) return response;
  const rejected = validateMutationRequest(request, user.id, requestId);
  if (rejected) return rejected;
  const parsed = await readJson(request, organizationUnitCreateSchema, requestId);
  if (parsed.response) return parsed.response;
  const scope = resolveOrganizationAccess(user, parsed.data.organizationId);
  if (scope.response) return scope.response;

  try {
    const data = await createOrganizationUnit(
      { ...parsed.data, organizationId: scope.organizationId },
      user,
      requestId,
    );
    return successResponse(data, {
      status: 201,
      code: "ORGANIZATION_UNIT_CREATED",
      message: "Divisi atau unit berhasil dibuat.",
    });
  } catch (error) {
    return handleRouteError("organization-units.create", error, requestId);
  }
}
