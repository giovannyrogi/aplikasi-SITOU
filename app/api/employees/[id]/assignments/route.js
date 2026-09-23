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
  readMultipartJson,
  successResponse,
  validateMutationRequest,
} from "@/lib/api/routeHelpers";
import { employeeAssignmentCreateSchema } from "@/lib/employees/schemas";
import { createEmployeeAssignment, getEmployeeHistory } from "@/lib/employees/service";

/** Menampilkan histori penempatan pegawai. */
export async function GET(request, context) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("assignments.read");
  if (response) return response;
  const id = parsePositiveInteger((await context.params).id, "ID pegawai");
  if (id.error) return errorResponse("INVALID_ID", id.error, 400, requestId);
  try {
    const organizationId = resolvePermissionOrganization(
      user,
      new URL(request.url).searchParams.get("organizationId"),
    );
    await ensureActorEmployeeAccess(user, id.value, organizationId);
    const history = await getEmployeeHistory(id.value, organizationId);
    return successResponse(history.assignments);
  } catch (error) {
    return handleRouteError("employee-assignments.list", error, requestId);
  }
}

/** Membuat rolling/mutasi sebagai record histori baru. */
export async function POST(request, context) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("assignments.manage");
  if (response) return response;
  const rejected = await validateMutationRequest(request, user.id, requestId, {
    maxBytes: 11 * 1024 * 1024,
  });
  if (rejected) return rejected;
  const id = parsePositiveInteger((await context.params).id, "ID pegawai");
  if (id.error) return errorResponse("INVALID_ID", id.error, 400, requestId);
  const parsed = await readMultipartJson(request, employeeAssignmentCreateSchema, requestId);
  if (parsed.response) return parsed.response;
  try {
    const organizationId = resolvePermissionOrganization(user, parsed.data.organizationId);
    const data = await createEmployeeAssignment(
      id.value,
      organizationId,
      parsed.data,
      user,
      requestId,
      parsed.file,
    );
    return successResponse(data.assignments, {
      status: 201,
      code: "ASSIGNMENT_CREATED",
      message: "Penempatan baru berhasil dicatat.",
    });
  } catch (error) {
    return handleRouteError("employee-assignments.create", error, requestId);
  } finally {
    await parsed.cleanup?.();
  }
}
