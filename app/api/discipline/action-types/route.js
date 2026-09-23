import { requirePermission, resolvePermissionOrganization } from "@/lib/auth/permissions";
import {
  getRequestId,
  handleRouteError,
  parseListQuery,
  readJson,
  ServiceError,
  successResponse,
  validateMutationRequest,
} from "@/lib/api/routeHelpers";
import { disciplinaryActionTypeCreateSchema } from "@/lib/discipline/actionTypeSchemas";
import {
  createDisciplinaryActionType,
  getDisciplinaryActionTypeOptions,
  listDisciplinaryActionTypes,
} from "@/lib/discipline/actionTypeService";

export async function GET(request) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("discipline_settings.read");
  if (response) return response;
  try {
    const url = new URL(request.url);
    const organizationId = resolvePermissionOrganization(
      user,
      url.searchParams.get("organizationId") || null,
      { optional: true },
    );
    if (url.searchParams.get("options") === "true") {
      if (!organizationId)
        throw new ServiceError("ORGANIZATION_REQUIRED", "Organisasi wajib dipilih.", 400);
      return successResponse(
        await getDisciplinaryActionTypeOptions(
          organizationId,
          url.searchParams.get("activeOnly") !== "false",
        ),
      );
    }
    const query = parseListQuery(url.searchParams);
    const result = await listDisciplinaryActionTypes({ ...query, organizationId });
    return successResponse(result.data, {
      pagination: { page: query.page, pageSize: query.pageSize, total: result.total },
    });
  } catch (error) {
    return handleRouteError("discipline.action-types.list", error, requestId);
  }
}

export async function POST(request) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("discipline_settings.manage");
  if (response) return response;
  if (user.role_code !== "superadmin")
    return handleRouteError(
      "discipline.action-types.create",
      new ServiceError("FORBIDDEN", "Hanya Superadmin yang dapat menambahkan jenis sanksi.", 403),
      requestId,
    );
  const rejected = await validateMutationRequest(request, user.id, requestId);
  if (rejected) return rejected;
  const parsed = await readJson(request, disciplinaryActionTypeCreateSchema, requestId);
  if (parsed.response) return parsed.response;
  try {
    const organizationId = resolvePermissionOrganization(user, parsed.data.organizationId);
    const data = await createDisciplinaryActionType(
      { ...parsed.data, organizationId },
      user,
      requestId,
    );
    return successResponse(data, {
      status: 201,
      code: "DISCIPLINARY_ACTION_TYPE_CREATED",
      message: "Jenis sanksi berhasil ditambahkan.",
    });
  } catch (error) {
    return handleRouteError("discipline.action-types.create", error, requestId);
  }
}
