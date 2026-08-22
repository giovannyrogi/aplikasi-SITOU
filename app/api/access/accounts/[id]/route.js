import { requirePermission, resolvePermissionOrganization } from "@/lib/auth/permissions";
import {
  getRequestId,
  handleRouteError,
  readJson,
  successResponse,
  validateMutationRequest,
} from "@/lib/api/routeHelpers";
import { accountUpdateSchema } from "@/lib/access/schemas";
import { getOrganizationAccount, updateOrganizationAccount } from "@/lib/access/service";

/** Mengambil detail akun berdasarkan organisasi efektif. */
export async function GET(request, { params }) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("accounts.read");
  if (response) return response;
  try {
    const { id } = await params;
    const organizationId = resolvePermissionOrganization(
      user,
      new URL(request.url).searchParams.get("organizationId"),
    );
    return successResponse(await getOrganizationAccount(id, organizationId));
  } catch (error) {
    return handleRouteError("access.accounts.detail", error, requestId);
  }
}

/** Memperbarui akun, role, profil opsional, dan scope lokasi. */
export async function PATCH(request, { params }) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("accounts.manage");
  if (response) return response;
  const rejected = validateMutationRequest(request, user.id, requestId);
  if (rejected) return rejected;
  const parsed = await readJson(request, accountUpdateSchema, requestId);
  if (parsed.response) return parsed.response;
  try {
    const { id } = await params;
    const organizationId = resolvePermissionOrganization(user, parsed.data.organizationId);
    const data = await updateOrganizationAccount(
      id,
      { ...parsed.data, organizationId },
      user,
      requestId,
    );
    return successResponse(data, {
      code: "ACCOUNT_UPDATED",
      message: "Akun organisasi berhasil diperbarui.",
    });
  } catch (error) {
    return handleRouteError("access.accounts.update", error, requestId);
  }
}
