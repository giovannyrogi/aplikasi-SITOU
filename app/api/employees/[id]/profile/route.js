import {
  ensureActorEmployeeAccess,
  requirePermission,
  resolvePermissionOrganization,
} from "@/lib/auth/permissions";
import {
  getRequestId,
  handleRouteError,
  readJson,
  successResponse,
  validateMutationRequest,
} from "@/lib/api/routeHelpers";
import { employeeProfileUpdateSchema } from "@/lib/employees/profileSchemas";
import {
  getEmployeeProfileSections,
  updateEmployeeProfileSections,
} from "@/lib/employees/profileService";

/** Mengambil section profil sensitif setelah permission dan scope pegawai diperiksa. */
export async function GET(request, { params }) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("employees.read_sensitive");
  if (response) return response;
  try {
    const { id } = await params;
    const organizationId = resolvePermissionOrganization(
      user,
      new URL(request.url).searchParams.get("organizationId"),
    );
    await ensureActorEmployeeAccess(user, id, organizationId);
    return successResponse(
      await getEmployeeProfileSections(id, organizationId, undefined, {
        includeBankAccounts: user.role_code !== "leader",
      }),
    );
  } catch (error) {
    return handleRouteError("employees.profile.get", error, requestId);
  }
}

/** Mengganti data administratif nonhistoris tanpa menyentuh kontrak dan penempatan. */
export async function PATCH(request, { params }) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("employees.update");
  if (response) return response;
  const rejected = validateMutationRequest(request, user.id, requestId);
  if (rejected) return rejected;
  const parsed = await readJson(request, employeeProfileUpdateSchema, requestId);
  if (parsed.response) return parsed.response;
  try {
    const { id } = await params;
    const organizationId = resolvePermissionOrganization(user, parsed.data.organizationId);
    const data = await updateEmployeeProfileSections(
      id,
      organizationId,
      parsed.data.profile,
      user,
      requestId,
    );
    return successResponse(data, {
      code: "EMPLOYEE_PROFILE_UPDATED",
      message: "Data administratif pegawai berhasil diperbarui.",
    });
  } catch (error) {
    return handleRouteError("employees.profile.update", error, requestId);
  }
}
