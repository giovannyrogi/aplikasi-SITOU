import { requirePermission, resolvePermissionOrganization } from "@/lib/auth/permissions";
import {
  errorResponse,
  getRequestId,
  handleRouteError,
  successResponse,
  validateMutationRequest,
} from "@/lib/api/routeHelpers";
import { createEmployeeDraft, getActiveEmployeeDraft } from "@/lib/employees/draftService";

/** Mengambil draft aktif milik actor pada organisasi efektif. */
export async function GET(request) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("employees.create");
  if (response) return response;
  try {
    const organizationId = resolvePermissionOrganization(
      user,
      new URL(request.url).searchParams.get("organizationId"),
    );
    return successResponse(await getActiveEmployeeDraft(organizationId, user));
  } catch (error) {
    return handleRouteError("employee-drafts.get", error, requestId);
  }
}

/** Membuat draft baru atau mengembalikan draft aktif yang sudah ada. */
export async function POST(request) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("employees.create");
  if (response) return response;
  const rejected = validateMutationRequest(request, user.id, requestId);
  if (rejected) return rejected;
  try {
    const body = await request.json().catch(() => ({}));
    const organizationId = resolvePermissionOrganization(user, body.organizationId);
    if (!organizationId)
      return errorResponse("ORGANIZATION_REQUIRED", "Organisasi wajib dipilih.", 400, requestId);
    return successResponse(await createEmployeeDraft(organizationId, user, requestId), {
      status: 201,
      code: "EMPLOYEE_DRAFT_READY",
      message: "Draft pegawai siap digunakan.",
    });
  } catch (error) {
    return handleRouteError("employee-drafts.create", error, requestId);
  }
}
