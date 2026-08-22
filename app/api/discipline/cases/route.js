import { requirePermission, resolvePermissionOrganization } from "@/lib/auth/permissions";
import {
  errorResponse,
  getRequestId,
  handleRouteError,
  parseListQuery,
  readJson,
  successResponse,
  validateMutationRequest,
} from "@/lib/api/routeHelpers";
import { disciplineCaseCreateSchema, disciplineListFilterSchema } from "@/lib/discipline/schemas";
import { createDisciplineCase, listDisciplineCases } from "@/lib/discipline/service";

/** Menampilkan kasus disiplin manual sesuai organisasi actor. */
export async function GET(request) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("discipline.read");
  if (response) return response;
  try {
    const url = new URL(request.url);
    const query = parseListQuery(url.searchParams);
    const filters = disciplineListFilterSchema.safeParse({
      organizationId: url.searchParams.get("organizationId") || null,
      employeeId: url.searchParams.get("employeeId") || null,
      severity: url.searchParams.get("severity") || "all",
      caseStatus: url.searchParams.get("caseStatus") || "all",
    });
    if (!filters.success)
      return errorResponse("VALIDATION_ERROR", "Filter kasus tidak valid.", 400, requestId);
    const organizationId = resolvePermissionOrganization(user, filters.data.organizationId);
    const result = await listDisciplineCases({
      ...query,
      ...filters.data,
      organizationId,
      actor: user,
    });
    return successResponse(result.data, {
      pagination: { page: query.page, pageSize: query.pageSize, total: result.total },
    });
  } catch (error) {
    return handleRouteError("discipline.cases.list", error, requestId);
  }
}

/** Membuka kasus disiplin tanpa menerbitkan sanksi otomatis. */
export async function POST(request) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("discipline.manage");
  if (response) return response;
  const rejected = validateMutationRequest(request, user.id, requestId);
  if (rejected) return rejected;
  const parsed = await readJson(request, disciplineCaseCreateSchema, requestId);
  if (parsed.response) return parsed.response;
  try {
    const organizationId = resolvePermissionOrganization(user, parsed.data.organizationId);
    const data = await createDisciplineCase({ ...parsed.data, organizationId }, user, requestId);
    return successResponse(data, {
      status: 201,
      code: "DISCIPLINE_CASE_CREATED",
      message: "Kasus disiplin berhasil dibuka.",
    });
  } catch (error) {
    return handleRouteError("discipline.cases.create", error, requestId);
  }
}
