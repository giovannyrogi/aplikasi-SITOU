import { parsePositiveInteger } from "@/app/utils/apiValidation";
import {
  ensureActorEmployeeAccess,
  requirePermission,
  resolvePermissionOrganization,
} from "@/lib/auth/permissions";
import {
  errorResponse,
  getRequestId,
  handleRouteError,
  successResponse,
} from "@/lib/api/routeHelpers";
import { getEmployeeDocumentChecklist } from "@/lib/files/storage";

/** Mengembalikan checklist dokumen tanpa mengekspos object key penyimpanan. */
export async function GET(request, context) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("private_files.read");
  if (response) return response;
  const id = parsePositiveInteger((await context.params).id, "ID pegawai");
  if (id.error) return errorResponse("INVALID_ID", id.error, 400, requestId);
  try {
    const organizationId = resolvePermissionOrganization(
      user,
      new URL(request.url).searchParams.get("organizationId"),
    );
    await ensureActorEmployeeAccess(user, id.value, organizationId);
    return successResponse(await getEmployeeDocumentChecklist(id.value, organizationId));
  } catch (error) {
    return handleRouteError("employees.documents", error, requestId);
  }
}
