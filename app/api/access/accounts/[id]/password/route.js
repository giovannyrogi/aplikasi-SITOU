import { requirePermission, resolvePermissionOrganization } from "@/lib/auth/permissions";
import {
  getRequestId,
  handleRouteError,
  readJson,
  successResponse,
  validateMutationRequest,
} from "@/lib/api/routeHelpers";
import { accountPasswordSchema } from "@/lib/access/schemas";
import { resetOrganizationAccountPassword } from "@/lib/access/service";

/** Mereset password; HRD hanya dapat mereset akun Pegawai pada organisasinya. */
export async function PATCH(request, { params }) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("accounts.manage");
  if (response) return response;
  const rejected = validateMutationRequest(request, user.id, requestId);
  if (rejected) return rejected;
  const parsed = await readJson(request, accountPasswordSchema, requestId);
  if (parsed.response) return parsed.response;
  try {
    const { id } = await params;
    const organizationId = resolvePermissionOrganization(user, parsed.data.organizationId);
    const data = await resetOrganizationAccountPassword(
      id,
      organizationId,
      parsed.data.password,
      user,
      requestId,
    );
    return successResponse(data, {
      code: "PASSWORD_RESET",
      message: "Password akun berhasil diperbarui.",
    });
  } catch (error) {
    return handleRouteError("access.accounts.password", error, requestId);
  }
}
