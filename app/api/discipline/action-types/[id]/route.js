import { requirePermission, resolvePermissionOrganization } from "@/lib/auth/permissions";
import {
  getRequestId,
  handleRouteError,
  readJson,
  successResponse,
  validateMutationRequest,
} from "@/lib/api/routeHelpers";
import { disciplinaryActionTypeUpdateSchema } from "@/lib/discipline/actionTypeSchemas";
import { updateDisciplinaryActionType } from "@/lib/discipline/actionTypeService";

export async function PATCH(request, { params }) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("discipline_settings.manage");
  if (response) return response;
  const rejected = validateMutationRequest(request, user.id, requestId);
  if (rejected) return rejected;
  const parsed = await readJson(request, disciplinaryActionTypeUpdateSchema, requestId);
  if (parsed.response) return parsed.response;
  try {
    const { id } = await params;
    const organizationId = resolvePermissionOrganization(user, parsed.data.organizationId);
    const data = await updateDisciplinaryActionType(
      id,
      { ...parsed.data, organizationId },
      user,
      requestId,
    );
    return successResponse(data, {
      code: "DISCIPLINARY_ACTION_TYPE_UPDATED",
      message: "Pengaturan sanksi berhasil disimpan.",
    });
  } catch (error) {
    return handleRouteError("discipline.action-types.update", error, requestId);
  }
}
