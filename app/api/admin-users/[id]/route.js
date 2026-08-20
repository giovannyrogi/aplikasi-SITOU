import { ROLES } from "@/app/constants/roles";
import { requireRole } from "@/app/utils/auth";
import { parsePositiveInteger } from "@/app/utils/apiValidation";
import {
  errorResponse,
  getRequestId,
  handleRouteError,
  readJson,
  successResponse,
  validateMutationRequest,
} from "@/lib/api/routeHelpers";
import { adminUserUpdateSchema } from "@/lib/master-data/schemas";
import { deactivateAdminUser, getAdminUser, updateAdminUser } from "@/lib/master-data/service";
const getId = async (params, requestId) => {
  const parsed = parsePositiveInteger((await params).id, "ID admin");
  return parsed.error
    ? { response: errorResponse("INVALID_ID", parsed.error, 400, requestId) }
    : { id: parsed.value };
};
export async function GET(request, { params }) {
  const requestId = getRequestId(request);
  const { response } = await requireRole([ROLES.SUPERADMIN]);
  if (response) return response;
  const target = await getId(params, requestId);
  if (target.response) return target.response;
  try {
    return successResponse(await getAdminUser(target.id));
  } catch (error) {
    return handleRouteError("admin-users.get", error, requestId);
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
  const parsed = await readJson(request, adminUserUpdateSchema, requestId);
  if (parsed.response) return parsed.response;
  try {
    return successResponse(await updateAdminUser(target.id, parsed.data, user, requestId), {
      code: "ADMIN_USER_UPDATED",
      message: "Admin/HRD berhasil diperbarui.",
    });
  } catch (error) {
    return handleRouteError("admin-users.update", error, requestId);
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
    return successResponse(await deactivateAdminUser(target.id, user, requestId), {
      code: "ADMIN_USER_DEACTIVATED",
      message: "Admin/HRD berhasil dinonaktifkan.",
    });
  } catch (error) {
    return handleRouteError("admin-users.deactivate", error, requestId);
  }
}
