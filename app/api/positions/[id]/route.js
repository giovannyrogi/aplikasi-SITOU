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
import { positionUpdateSchema } from "@/lib/master-data/schemas";
import {
  deactivatePosition,
  getPosition,
  updatePosition,
} from "@/lib/master-data/organizationStructureService";

/** Memvalidasi ID jabatan dari dynamic route. */
const getId = async (params, requestId) => {
  const parsed = parsePositiveInteger((await params).id, "ID jabatan");
  return parsed.error
    ? { response: errorResponse("INVALID_ID", parsed.error, 400, requestId) }
    : { id: parsed.value };
};

/** Mengambil detail jabatan dalam scope organisasi actor. */
export async function GET(request, { params }) {
  const requestId = getRequestId(request);
  const { user, response } = await requireRole([ROLES.SUPERADMIN, ROLES.HRD]);
  if (response) return response;
  const target = await getId(params, requestId);
  if (target.response) return target.response;
  const scope = resolveOrganizationAccess(user, null, { optional: true });
  if (scope.response) return scope.response;
  try {
    return successResponse(await getPosition(target.id, scope.organizationId));
  } catch (error) {
    return handleRouteError("positions.get", error, requestId);
  }
}

/** Memperbarui jabatan dengan validasi versi record. */
export async function PATCH(request, { params }) {
  const requestId = getRequestId(request);
  const { user, response } = await requireRole([ROLES.SUPERADMIN, ROLES.HRD]);
  if (response) return response;
  const target = await getId(params, requestId);
  if (target.response) return target.response;
  const rejected = validateMutationRequest(request, user.id, requestId);
  if (rejected) return rejected;
  const parsed = await readJson(request, positionUpdateSchema, requestId);
  if (parsed.response) return parsed.response;
  const scope = resolveOrganizationAccess(user, parsed.data.organizationId);
  if (scope.response) return scope.response;
  try {
    const data = await updatePosition(
      target.id,
      { ...parsed.data, organizationId: scope.organizationId },
      user,
      requestId,
    );
    return successResponse(data, {
      code: "POSITION_UPDATED",
      message: "Jabatan berhasil diperbarui.",
    });
  } catch (error) {
    return handleRouteError("positions.update", error, requestId);
  }
}

/** Menonaktifkan jabatan tanpa menghapus histori penempatan. */
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
    const data = await deactivatePosition(target.id, scope.organizationId, user, requestId);
    return successResponse(data, {
      code: "POSITION_DEACTIVATED",
      message: "Jabatan berhasil dinonaktifkan.",
    });
  } catch (error) {
    return handleRouteError("positions.deactivate", error, requestId);
  }
}
