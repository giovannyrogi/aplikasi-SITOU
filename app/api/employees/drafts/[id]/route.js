import { parsePositiveInteger } from "@/app/utils/apiValidation";
import { requirePermission, resolvePermissionOrganization } from "@/lib/auth/permissions";
import {
  errorResponse,
  getRequestId,
  handleRouteError,
  readJson,
  successResponse,
  validateMutationRequest,
} from "@/lib/api/routeHelpers";
import { employeeDraftSaveSchema } from "@/lib/employees/schemas";
import { discardEmployeeDraft, saveEmployeeDraft } from "@/lib/employees/draftService";

/** Menyimpan snapshot wizard dengan optimistic concurrency. */
export async function PATCH(request, { params }) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("employees.create");
  if (response) return response;
  const rejected = validateMutationRequest(request, user.id, requestId);
  if (rejected) return rejected;
  const id = parsePositiveInteger((await params).id, "ID draft");
  if (id.error) return errorResponse("INVALID_ID", id.error, 400, requestId);
  const parsed = await readJson(request, employeeDraftSaveSchema, requestId);
  if (parsed.response) return parsed.response;
  try {
    const organizationId = resolvePermissionOrganization(user, parsed.data.organizationId);
    return successResponse(
      await saveEmployeeDraft({ ...parsed.data, id: id.value, organizationId }, user, requestId),
      { code: "EMPLOYEE_DRAFT_SAVED", message: "Draft tersimpan." },
    );
  } catch (error) {
    return handleRouteError("employee-drafts.save", error, requestId);
  }
}

/** Membuang draft aktif beserta file staging secara soft delete. */
export async function DELETE(request, { params }) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("employees.create");
  if (response) return response;
  const rejected = validateMutationRequest(request, user.id, requestId);
  if (rejected) return rejected;
  const id = parsePositiveInteger((await params).id, "ID draft");
  if (id.error) return errorResponse("INVALID_ID", id.error, 400, requestId);
  try {
    const organizationId = resolvePermissionOrganization(
      user,
      new URL(request.url).searchParams.get("organizationId"),
    );
    await discardEmployeeDraft(id.value, organizationId, user, requestId);
    return successResponse(null, {
      code: "EMPLOYEE_DRAFT_DISCARDED",
      message: "Draft berhasil dihapus.",
    });
  } catch (error) {
    return handleRouteError("employee-drafts.discard", error, requestId);
  }
}
