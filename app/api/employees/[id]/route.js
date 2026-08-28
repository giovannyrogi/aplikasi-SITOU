import { parsePositiveInteger } from "@/app/utils/apiValidation";
import { ROLES } from "@/app/constants/roles";
import {
  ensureActorEmployeeAccess,
  requirePermission,
  resolvePermissionOrganization,
} from "@/lib/auth/permissions";
import {
  errorResponse,
  getRequestId,
  handleRouteError,
  readJson,
  successResponse,
  validateMutationRequest,
} from "@/lib/api/routeHelpers";
import { employeeTerminationSchema, employeeUpdateSchema } from "@/lib/employees/schemas";
import { getEmployee, terminateEmployee, updateEmployee } from "@/lib/employees/service";

const resolveId = async (context, requestId) => {
  const parsed = parsePositiveInteger((await context.params).id, "ID pegawai");
  return parsed.error
    ? { id: null, response: errorResponse("INVALID_ID", parsed.error, 400, requestId) }
    : { id: parsed.value, response: null };
};

/** Mengambil detail pegawai untuk halaman detail dan form edit. */
export async function GET(request, context) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("employees.read");
  if (response) return response;
  const resolved = await resolveId(context, requestId);
  if (resolved.response) return resolved.response;
  try {
    const organizationId = resolvePermissionOrganization(
      user,
      new URL(request.url).searchParams.get("organizationId"),
    );
    await ensureActorEmployeeAccess(user, resolved.id, organizationId);
    const data = await getEmployee(resolved.id, organizationId);
    if (user.role_code === ROLES.LEADER) {
      const leaderData = { ...data };
      delete leaderData.user_id;
      return successResponse(leaderData);
    }
    return successResponse(data);
  } catch (error) {
    return handleRouteError("employees.get", error, requestId);
  }
}

/** Memperbarui profil dan kontak tanpa menimpa histori kontrak/penempatan. */
export async function PATCH(request, context) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("employees.update");
  if (response) return response;
  const rejected = validateMutationRequest(request, user.id, requestId);
  if (rejected) return rejected;
  const resolved = await resolveId(context, requestId);
  if (resolved.response) return resolved.response;
  const parsed = await readJson(request, employeeUpdateSchema, requestId);
  if (parsed.response) return parsed.response;
  try {
    const organizationId = resolvePermissionOrganization(user, parsed.data.organizationId);
    const data = await updateEmployee(
      resolved.id,
      { ...parsed.data, organizationId },
      user,
      requestId,
    );
    return successResponse(data, { code: "EMPLOYEE_UPDATED", message: "Data pegawai diperbarui." });
  } catch (error) {
    return handleRouteError("employees.update", error, requestId);
  }
}

/** Mengakhiri status pegawai tanpa menghapus histori. */
export async function DELETE(request, context) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("employees.deactivate");
  if (response) return response;
  const rejected = validateMutationRequest(request, user.id, requestId);
  if (rejected) return rejected;
  const resolved = await resolveId(context, requestId);
  if (resolved.response) return resolved.response;
  const parsed = await readJson(request, employeeTerminationSchema, requestId);
  if (parsed.response) return parsed.response;
  try {
    const organizationId = resolvePermissionOrganization(user, parsed.data.organizationId);
    const data = await terminateEmployee(resolved.id, organizationId, parsed.data, user, requestId);
    return successResponse(data, {
      code: "EMPLOYEE_TERMINATED",
      message: "Hubungan kerja pegawai berhasil diakhiri dan seluruh histori tetap tersimpan.",
    });
  } catch (error) {
    return handleRouteError("employees.terminate", error, requestId);
  }
}
