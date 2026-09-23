import { requirePermission, resolvePermissionOrganization } from "@/lib/auth/permissions";
import {
  getRequestId,
  handleRouteError,
  readMultipartJson,
  successResponse,
  validateMutationRequest,
} from "@/lib/api/routeHelpers";
import { disciplinaryActionCreateSchema } from "@/lib/discipline/schemas";
import { createDisciplinaryAction } from "@/lib/discipline/service";

/** Menerbitkan tindakan resmi yang tetap memerlukan keputusan manusia dari HRD. */
export async function POST(request, { params }) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("discipline.manage");
  if (response) return response;
  const rejected = await validateMutationRequest(request, user.id, requestId, { maxBytes: 11 * 1024 * 1024 });
  if (rejected) return rejected;
  const parsed = await readMultipartJson(request, disciplinaryActionCreateSchema, requestId);
  if (parsed.response) return parsed.response;
  try {
    const { id } = await params;
    const organizationId = resolvePermissionOrganization(user, parsed.data.organizationId);
    const data = await createDisciplinaryAction(
      id,
      { ...parsed.data, organizationId },
      user,
      requestId,
      parsed.file,
    );
    return successResponse(data, {
      status: 201,
      code: "DISCIPLINARY_ACTION_CREATED",
      message: "Tindakan disiplin berhasil dicatat.",
    });
  } catch (error) {
    return handleRouteError("discipline.actions.create", error, requestId);
  } finally {
    await parsed.cleanup?.();
  }
}
