import { ROLES } from "@/app/constants/roles";
import { requireRole } from "@/app/utils/auth";
import { parsePositiveInteger } from "@/app/utils/apiValidation";
import { organizationUpdateSchema } from "@/lib/master-data/schemas";
import {
  deactivateOrganization,
  getOrganization,
  updateOrganization,
} from "@/lib/master-data/service";
import {
  errorResponse,
  getRequestId,
  handleRouteError,
  readJson,
  successResponse,
  validateMutationRequest,
} from "@/lib/api/routeHelpers";

const getId = async (params, requestId) => {
  const result = parsePositiveInteger((await params).id, "ID organisasi");
  return result.error
    ? { response: errorResponse("INVALID_ID", result.error, 400, requestId) }
    : { id: result.value };
};

export async function GET(request, { params }) {
  const requestId = getRequestId(request);
  const { response } = await requireRole([ROLES.SUPERADMIN]);
  if (response) return response;
  const target = await getId(params, requestId);
  if (target.response) return target.response;
  try {
    return successResponse(await getOrganization(target.id));
  } catch (error) {
    return handleRouteError("organizations.get", error, requestId);
  }
}

export async function PATCH(request, { params }) {
  const requestId = getRequestId(request);
  const { user, response } = await requireRole([ROLES.SUPERADMIN]);
  if (response) return response;
  const target = await getId(params, requestId);
  if (target.response) return target.response;
  const rejected = validateMutationRequest(request, user.id, requestId);
  if (rejected) return rejected;
  const parsed = await readJson(request, organizationUpdateSchema, requestId);
  if (parsed.response) return parsed.response;
  try {
    return successResponse(await updateOrganization(target.id, parsed.data, user, requestId), {
      code: "ORGANIZATION_UPDATED",
      message: "Organisasi berhasil diperbarui.",
    });
  } catch (error) {
    return handleRouteError("organizations.update", error, requestId);
  }
}

export async function DELETE(request, { params }) {
  const requestId = getRequestId(request);
  const { user, response } = await requireRole([ROLES.SUPERADMIN]);
  if (response) return response;
  const target = await getId(params, requestId);
  if (target.response) return target.response;
  const rejected = validateMutationRequest(request, user.id, requestId);
  if (rejected) return rejected;
  try {
    return successResponse(await deactivateOrganization(target.id, user, requestId), {
      code: "ORGANIZATION_DEACTIVATED",
      message: "Organisasi berhasil dinonaktifkan.",
    });
  } catch (error) {
    return handleRouteError("organizations.deactivate", error, requestId);
  }
}
