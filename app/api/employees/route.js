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
import { employeeCreateSchema, employeeListFilterSchema } from "@/lib/employees/schemas";
import { createEmployee, listEmployees } from "@/lib/employees/service";

/** Menampilkan daftar pegawai sesuai organisasi dan cakupan actor. */
export async function GET(request) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("employees.read");
  if (response) return response;
  try {
    const url = new URL(request.url);
    const query = parseListQuery(url.searchParams);
    const filters = employeeListFilterSchema.safeParse({
      organizationId: url.searchParams.get("organizationId") || null,
      locationId: url.searchParams.get("locationId") || null,
      organizationUnitId: url.searchParams.get("organizationUnitId") || null,
      positionId: url.searchParams.get("positionId") || null,
      employmentTypeId: url.searchParams.get("employmentTypeId") || null,
      sanction: url.searchParams.get("sanction") || "all",
    });
    if (!filters.success)
      return errorResponse("VALIDATION_ERROR", "Filter pegawai tidak valid.", 400, requestId);
    const organizationId = resolvePermissionOrganization(user, filters.data.organizationId);
    const result = await listEmployees({ ...query, ...filters.data, organizationId, actor: user });
    return successResponse(result.data, {
      pagination: { page: query.page, pageSize: query.pageSize, total: result.total },
    });
  } catch (error) {
    return handleRouteError("employees.list", error, requestId);
  }
}

/** Membuat profil, kontrak, dan penempatan awal secara atomik. */
export async function POST(request) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("employees.create");
  if (response) return response;
  const rejected = validateMutationRequest(request, user.id, requestId);
  if (rejected) return rejected;
  const parsed = await readJson(request, employeeCreateSchema, requestId);
  if (parsed.response) return parsed.response;
  try {
    const organizationId = resolvePermissionOrganization(user, parsed.data.organizationId);
    const data = await createEmployee({ ...parsed.data, organizationId }, user, requestId);
    return successResponse(data, {
      status: 201,
      code: "EMPLOYEE_CREATED",
      message: "Data pegawai berhasil dibuat.",
    });
  } catch (error) {
    return handleRouteError("employees.create", error, requestId);
  }
}
