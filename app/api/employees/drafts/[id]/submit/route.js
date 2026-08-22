import { parsePositiveInteger } from "@/app/utils/apiValidation";
import { requirePermission, resolvePermissionOrganization } from "@/lib/auth/permissions";
import {
  errorResponse,
  getRequestId,
  handleRouteError,
  successResponse,
  validateMutationRequest,
} from "@/lib/api/routeHelpers";
import { submitEmployeeDraft } from "@/lib/employees/draftService";

/** Memfinalisasi draft secara idempotent menjadi pegawai, kontrak, dan penempatan awal. */
export async function POST(request, { params }) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("employees.create");
  if (response) return response;
  const rejected = validateMutationRequest(request, user.id, requestId);
  if (rejected) return rejected;
  const id = parsePositiveInteger((await params).id, "ID draft");
  if (id.error) return errorResponse("INVALID_ID", id.error, 400, requestId);
  try {
    const body = await request.json().catch(() => ({}));
    const organizationId = resolvePermissionOrganization(user, body.organizationId);
    return successResponse(await submitEmployeeDraft(id.value, organizationId, user, requestId), {
      status: 201,
      code: "EMPLOYEE_CREATED",
      message: "Data pegawai berhasil dibuat.",
    });
  } catch (error) {
    return handleRouteError("employee-drafts.submit", error, requestId);
  }
}
