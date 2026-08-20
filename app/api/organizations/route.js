import { ROLES } from "@/app/constants/roles";
import { requireRole } from "@/app/utils/auth";
import { organizationSchema } from "@/lib/master-data/schemas";
import { createOrganization, listOrganizations } from "@/lib/master-data/service";
import {
  getRequestId,
  handleRouteError,
  parseListQuery,
  readJson,
  successResponse,
  validateMutationRequest,
} from "@/lib/api/routeHelpers";

export async function GET(request) {
  const requestId = getRequestId(request);
  const { user, response } = await requireRole([ROLES.SUPERADMIN]);
  if (response) return response;
  try {
    const query = parseListQuery(new URL(request.url).searchParams);
    const result = await listOrganizations(query);
    return successResponse(result.data, {
      pagination: { page: query.page, pageSize: query.pageSize, total: result.total },
    });
  } catch (error) {
    return handleRouteError("organizations.list", error, requestId);
  }
}

export async function POST(request) {
  const requestId = getRequestId(request);
  const { user, response } = await requireRole([ROLES.SUPERADMIN]);
  if (response) return response;
  const rejected = validateMutationRequest(request, user.id, requestId);
  if (rejected) return rejected;
  const parsed = await readJson(request, organizationSchema, requestId);
  if (parsed.response) return parsed.response;
  try {
    const data = await createOrganization(parsed.data, user, requestId);
    return successResponse(data, {
      status: 201,
      code: "ORGANIZATION_CREATED",
      message: "Organisasi berhasil dibuat.",
    });
  } catch (error) {
    return handleRouteError("organizations.create", error, requestId);
  }
}
