import { requirePermission, resolvePermissionOrganization } from "@/lib/auth/permissions";
import {
  getRequestId,
  handleRouteError,
  readJson,
  successResponse,
  validateMutationRequest,
} from "@/lib/api/routeHelpers";
import { disciplinaryActionUpdateSchema } from "@/lib/discipline/schemas";
import { updateDisciplinaryAction } from "@/lib/discipline/service";

/** Mengubah lifecycle tindakan tertulis tanpa menghapus record historisnya. */
export async function PATCH(request, { params }) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("discipline.manage");
  if (response) return response;
  const rejected = validateMutationRequest(request, user.id, requestId);
  if (rejected) return rejected;
  const parsed = await readJson(request, disciplinaryActionUpdateSchema, requestId);
  if (parsed.response) return parsed.response;
  try {
    const { id } = await params;
    const organizationId = resolvePermissionOrganization(user, parsed.data.organizationId);
    const data = await updateDisciplinaryAction(
      id,
      { ...parsed.data, organizationId },
      user,
      requestId,
    );
    return successResponse(data, {
      code: "DISCIPLINARY_ACTION_UPDATED",
      message: "Status tindakan disiplin berhasil diperbarui.",
    });
  } catch (error) {
    return handleRouteError("discipline.actions.update", error, requestId);
  }
}
