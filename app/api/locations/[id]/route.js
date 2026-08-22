import { ROLES } from "@/app/constants/roles";
import { requireRole, resolveOrganizationAccess } from "@/app/utils/auth";
import { parsePositiveInteger } from "@/app/utils/apiValidation";
import {
  errorResponse,
  getRequestId,
  handleRouteError,
  readJson,
  successResponse,
  validateMutationRequest,
} from "@/lib/api/routeHelpers";
import { locationSchema } from "@/lib/master-data/schemas";
import { deactivateLocation, getLocation, updateLocation } from "@/lib/master-data/service";

const getId = async (params, requestId) => {
  const parsed = parsePositiveInteger((await params).id, "ID lokasi");
  return parsed.error
    ? { response: errorResponse("INVALID_ID", parsed.error, 400, requestId) }
    : { id: parsed.value };
};
export async function GET(request, { params }) {
  const requestId = getRequestId(request);
  const { user, response } = await requireRole([ROLES.SUPERADMIN, ROLES.HRD]);
  if (response) return response;
  const target = await getId(params, requestId);
  if (target.response) return target.response;
  const scope = resolveOrganizationAccess(user, null, { optional: true });
  if (scope.response) return scope.response;
  try {
    return successResponse(await getLocation(target.id, undefined, scope.organizationId));
  } catch (error) {
    return handleRouteError("locations.get", error, requestId);
  }
}
export async function PATCH(request, { params }) {
  const requestId = getRequestId(request);
  const { user, response } = await requireRole([ROLES.SUPERADMIN, ROLES.HRD]);
  if (response) return response;
  const target = await getId(params, requestId);
  if (target.response) return target.response;
  const rejected = validateMutationRequest(request, user.id, requestId);
  if (rejected) return rejected;
  const parsed = await readJson(request, locationSchema, requestId);
  if (parsed.response) return parsed.response;
  const scope = resolveOrganizationAccess(user, parsed.data.organizationId);
  if (scope.response) return scope.response;
  try {
    return successResponse(
      await updateLocation(
        target.id,
        { ...parsed.data, organizationId: scope.organizationId },
        user,
        requestId,
        scope.organizationId,
      ),
      {
        code: "LOCATION_UPDATED",
        message: "Lokasi berhasil diperbarui.",
      },
    );
  } catch (error) {
    return handleRouteError("locations.update", error, requestId);
  }
}
export async function DELETE(request, { params }) {
  const requestId = getRequestId(request);
  const { user, response } = await requireRole([ROLES.SUPERADMIN, ROLES.HRD]);
  if (response) return response;
  const target = await getId(params, requestId);
  if (target.response) return target.response;
  const scope = resolveOrganizationAccess(user, null, { optional: true });
  if (scope.response) return scope.response;
  const rejected = validateMutationRequest(request, user.id, requestId);
  if (rejected) return rejected;
  try {
    return successResponse(
      await deactivateLocation(target.id, user, requestId, scope.organizationId),
      {
        code: "LOCATION_DEACTIVATED",
        message: "Lokasi berhasil dinonaktifkan. Histori dan cakupan akses tetap disimpan.",
      },
    );
  } catch (error) {
    return handleRouteError("locations.deactivate", error, requestId);
  }
}
