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
import { employeeAssignmentCorrectionSchema } from "@/lib/employees/schemas";
import { correctEmployeeAssignment } from "@/lib/employees/service";

async function resolveRouteIds(context, requestId) {
  const params = await context.params;
  const employeeId = parsePositiveInteger(params.id, "ID pegawai");
  const assignmentId = parsePositiveInteger(params.assignmentId, "ID penempatan");
  if (employeeId.error || assignmentId.error)
    return {
      response: errorResponse("INVALID_ID", employeeId.error || assignmentId.error, 400, requestId),
    };
  return { employeeId: employeeId.value, assignmentId: assignmentId.value };
}

/** Koreksi penempatan memperbarui salah input dengan audit dan optimistic concurrency. */
export async function PATCH(request, context) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("assignments.manage");
  if (response) return response;
  const rejected = validateMutationRequest(request, user.id, requestId);
  if (rejected) return rejected;
  const ids = await resolveRouteIds(context, requestId);
  if (ids.response) return ids.response;
  const parsed = await readJson(request, employeeAssignmentCorrectionSchema, requestId);
  if (parsed.response) return parsed.response;
  try {
    const organizationId = resolvePermissionOrganization(user, parsed.data.organizationId);
    const data = await correctEmployeeAssignment(
      ids.employeeId,
      ids.assignmentId,
      organizationId,
      parsed.data,
      user,
      requestId,
    );
    return successResponse(data.assignments, {
      code: "ASSIGNMENT_CORRECTED",
      message: "Koreksi penempatan berhasil disimpan.",
    });
  } catch (error) {
    return handleRouteError("employee-assignments.correct", error, requestId);
  }
}
