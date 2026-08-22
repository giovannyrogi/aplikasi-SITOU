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
import { employmentTypeCreateSchema } from "@/lib/master-data/schemas";
import {
  createEmploymentType,
  listEmploymentTypes,
} from "@/lib/master-data/organizationStructureService";

/** Menampilkan jenis kepegawaian sesuai scope organisasi actor. */
export async function GET(request) {
  const requestId = getRequestId(request);
  const { user, response } = await requireRole([ROLES.SUPERADMIN, ROLES.HRD]);
  if (response) return response;
  try {
    const url = new URL(request.url);
    const query = parseListQuery(url.searchParams);
    const rawOrganizationId = url.searchParams.get("organizationId");
    const parsed = rawOrganizationId
      ? parsePositiveInteger(rawOrganizationId, "ID organisasi")
      : { value: null, error: null };
    if (parsed.error) return errorResponse("INVALID_ID", parsed.error, 400, requestId);
    const scope = resolveOrganizationAccess(user, parsed.value, { optional: true });
    if (scope.response) return scope.response;
    const result = await listEmploymentTypes({ ...query, organizationId: scope.organizationId });
    return successResponse(result.data, {
      pagination: { page: query.page, pageSize: query.pageSize, total: result.total },
    });
  } catch (error) {
    return handleRouteError("employment-types.list", error, requestId);
  }
}

/** Membuat jenis kepegawaian pada organisasi yang telah diverifikasi server. */
export async function POST(request) {
  const requestId = getRequestId(request);
  const { user, response } = await requireRole([ROLES.SUPERADMIN, ROLES.HRD]);
  if (response) return response;
  const rejected = validateMutationRequest(request, user.id, requestId);
  if (rejected) return rejected;
  const parsed = await readJson(request, employmentTypeCreateSchema, requestId);
  if (parsed.response) return parsed.response;
  const scope = resolveOrganizationAccess(user, parsed.data.organizationId);
  if (scope.response) return scope.response;
  try {
    const data = await createEmploymentType(
      { ...parsed.data, organizationId: scope.organizationId },
      user,
      requestId,
    );
    return successResponse(data, {
      status: 201,
      code: "EMPLOYMENT_TYPE_CREATED",
      message: "Jenis kepegawaian berhasil dibuat.",
    });
  } catch (error) {
    return handleRouteError("employment-types.create", error, requestId);
  }
}
