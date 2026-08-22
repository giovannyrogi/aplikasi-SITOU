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
  const rejected = validateMutationRequest(request, user.id, requestId);
  if (rejected) return rejected;
  const id = parsePositiveInteger((await context.params).id, "ID pegawai");
  if (id.error) return errorResponse("INVALID_ID", id.error, 400, requestId);
  const parsed = await readJson(request, employeeAssignmentCreateSchema, requestId);
  if (parsed.response) return parsed.response;
  try {
    const organizationId = resolvePermissionOrganization(user, parsed.data.organizationId);
    const data = await createEmployeeAssignment(
      id.value,
      organizationId,
      parsed.data,
      user,
      requestId,
    );
    return successResponse(data.assignments, {
      status: 201,
      code: "ASSIGNMENT_CREATED",
      message: "Penempatan baru berhasil dicatat.",
    });
  } catch (error) {
    return handleRouteError("employee-assignments.create", error, requestId);
  }
}
