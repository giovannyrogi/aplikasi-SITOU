import { requirePermission, resolvePermissionOrganization } from "@/lib/auth/permissions";
import {
  getRequestId,
  handleRouteError,
  readMultipartJson,
  successResponse,
  validateMutationRequest,
} from "@/lib/api/routeHelpers";
import { disciplinaryActionUpdateSchema } from "@/lib/discipline/schemas";
import { updateDisciplinaryAction } from "@/lib/discipline/service";

/** Mengedit draft atau menerbitkannya; tindakan aktif tidak dapat ditimpa. */
export async function PATCH(request, { params }) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("discipline.manage");
  if (response) return response;
  const rejected = await validateMutationRequest(request, user.id, requestId, { maxBytes: 11 * 1024 * 1024 });
  if (rejected) return rejected;
  const parsed = await readMultipartJson(request, disciplinaryActionUpdateSchema, requestId);
  if (parsed.response) return parsed.response;
  try {
    const { id } = await params;
    const organizationId = resolvePermissionOrganization(user, parsed.data.organizationId);
    const data = await updateDisciplinaryAction(
      id,
      { ...parsed.data, organizationId },
      user,
      requestId,
      parsed.file,
    );
    return successResponse(data, {
      code: "DISCIPLINARY_ACTION_UPDATED",
      message:
        parsed.data.status === "active"
          ? "Tindakan disiplin berhasil diterbitkan."
          : "Draft tindakan disiplin berhasil diperbarui.",
    });
  } catch (error) {
    return handleRouteError("discipline.actions.update", error, requestId);
  } finally {
    await parsed.cleanup?.();
  }
}
