import { requirePermission, resolvePermissionOrganization } from "@/lib/auth/permissions";
import {
  errorResponse,
  getRequestId,
  handleRouteError,
  successResponse,
} from "@/lib/api/routeHelpers";
import { accountReferenceQuerySchema } from "@/lib/access/schemas";
import { getAccountReferenceOptions } from "@/lib/access/service";

/** Profil yang belum tertaut, dengan pengecualian profil akun edit yang berizin. */
export async function GET(request) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("accounts.manage");
  if (response) return response;
  try {
    const params = new URL(request.url).searchParams;
    const parsed = accountReferenceQuerySchema.safeParse({
      organizationId: params.get("organizationId") || null,
      accountId: params.get("accountId") || null,
    });
    if (!parsed.success)
      return errorResponse("VALIDATION_ERROR", "Referensi akun tidak valid.", 400, requestId);
    const organizationId = resolvePermissionOrganization(user, parsed.data.organizationId);
    return successResponse(
      await getAccountReferenceOptions(organizationId, user, parsed.data.accountId),
    );
  } catch (error) {
    return handleRouteError("access.accounts.reference-options", error, requestId);
  }
}
