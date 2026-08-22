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
import { organizationUnitUpdateSchema } from "@/lib/master-data/schemas";
import {
  deactivateOrganizationUnit,
  getOrganizationUnit,
  updateOrganizationUnit,
} from "@/lib/master-data/organizationStructureService";

/** Memvalidasi dynamic route ID sebelum menyentuh database. */
const getId = async (params, requestId) => {
  const parsed = parsePositiveInteger((await params).id, "ID divisi atau unit");
  return parsed.error
    ? { response: errorResponse("INVALID_ID", parsed.error, 400, requestId) }
    : { id: parsed.value };
};

/** Mengambil detail unit hanya dalam scope organisasi actor. */
export async function GET(request, { params }) {
  const requestId = getRequestId(request);
  const { user, response } = await requireRole([ROLES.SUPERADMIN, ROLES.HRD]);
  if (response) return response;
  const target = await getId(params, requestId);
  if (target.response) return target.response;
  const scope = resolveOrganizationAccess(user, null, { optional: true });
  if (scope.response) return scope.response;
  try {
    return successResponse(await getOrganizationUnit(target.id, scope.organizationId));
  } catch (error) {
    return handleRouteError("organization-units.get", error, requestId);
  }
}

/** Memperbarui unit setelah payload dan organization scope tervalidasi. */
export async function PATCH(request, { params }) {
  const requestId = getRequestId(request);
  const { user, response } = await requireRole([ROLES.SUPERADMIN, ROLES.HRD]);
  if (response) return response;
  const target = await getId(params, requestId);
  if (target.response) return target.response;
  const rejected = validateMutationRequest(request, user.id, requestId);
  if (rejected) return rejected;
  const parsed = await readJson(request, organizationUnitUpdateSchema, requestId);
  if (parsed.response) return parsed.response;
  const scope = resolveOrganizationAccess(user, parsed.data.organizationId);
  if (scope.response) return scope.response;
  try {
    const data = await updateOrganizationUnit(
      target.id,
      { ...parsed.data, organizationId: scope.organizationId },
      user,
      requestId,
    );
    return successResponse(data, {
      code: "ORGANIZATION_UNIT_UPDATED",
      message: "Divisi atau unit berhasil diperbarui.",
    });
  } catch (error) {
    return handleRouteError("organization-units.update", error, requestId);
  }
}

/** Menonaktifkan unit tanpa menghapus histori struktur atau penempatan. */
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
    const data = await deactivateOrganizationUnit(target.id, scope.organizationId, user, requestId);
    return successResponse(data, {
      code: "ORGANIZATION_UNIT_DEACTIVATED",
      message: "Divisi atau unit berhasil dinonaktifkan.",
    });
  } catch (error) {
    return handleRouteError("organization-units.deactivate", error, requestId);
  }
}
