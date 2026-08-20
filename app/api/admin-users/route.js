import { ROLES } from "@/app/constants/roles";
import { requireRole } from "@/app/utils/auth";
import { parsePositiveInteger } from "@/app/utils/apiValidation";
import {
  getRequestId,
  handleRouteError,
  parseListQuery,
  readJson,
  successResponse,
  validateMutationRequest,
} from "@/lib/api/routeHelpers";
import { adminUserCreateSchema } from "@/lib/master-data/schemas";
import { createAdminUser, listAdminUsers } from "@/lib/master-data/service";

export async function GET(request) {
  const requestId = getRequestId(request);
  const { response } = await requireRole([ROLES.SUPERADMIN]);
  if (response) return response;
  try {
    const url = new URL(request.url);
    const query = parseListQuery(url.searchParams);
    const organization = url.searchParams.get("organizationId");
    query.organizationId = organization ? parsePositiveInteger(organization).value : null;
    const result = await listAdminUsers(query);
    return successResponse(result.data, {
      pagination: { page: query.page, pageSize: query.pageSize, total: result.total },
    });
  } catch (error) {
    return handleRouteError("admin-users.list", error, requestId);
  }
}
export async function POST(request) {
  const requestId = getRequestId(request);
  const { user, response } = await requireRole([ROLES.SUPERADMIN]);
  if (response) return response;
  const rejected = validateMutationRequest(request, user.id, requestId);
  if (rejected) return rejected;
  const parsed = await readJson(request, adminUserCreateSchema, requestId);
  if (parsed.response) return parsed.response;
  try {
    return successResponse(await createAdminUser(parsed.data, user, requestId), {
      status: 201,
      code: "ADMIN_USER_CREATED",
      message: "Admin/HRD berhasil dibuat.",
    });
  } catch (error) {
    return handleRouteError("admin-users.create", error, requestId);
  }
}
