import { requirePermission, resolvePermissionOrganization } from "@/lib/auth/permissions";
import { readModule } from "@/lib/access/packageRepository";
import { updateModule } from "@/lib/access/packages";
import { moduleUpdateSchema } from "@/lib/inventory/schemas";
import { parsePositiveInteger } from "@/app/utils/apiValidation";
import {
  getRequestId,
  handleRouteError,
  readJson,
  successResponse,
  validateMutationRequest,
  errorResponse,
} from "@/lib/api/routeHelpers";
export async function GET(request) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("access.modules.manage");
  if (response) return response;
  try {
    const requested = parsePositiveInteger(
      new URL(request.url).searchParams.get("organizationId"),
      "Organisasi",
    );
    if (requested.error)
      return errorResponse("INVALID_ORGANIZATION", requested.error, 400, requestId, {
        organizationId: requested.error,
      });
    const org = resolvePermissionOrganization(
      user,
      new URL(request.url).searchParams.get("organizationId"),
    );
    return successResponse(await readModule(org));
  } catch (error) {
    return handleRouteError("access.modules.read", error, requestId);
  }
}
export async function PATCH(request) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("access.modules.manage");
  if (response) return response;
  const rejected = await validateMutationRequest(request, user.id, requestId);
  if (rejected) return rejected;
  const parsed = await readJson(request, moduleUpdateSchema, requestId);
  if (parsed.response) return parsed.response;
  try {
    const org = resolvePermissionOrganization(user, parsed.data.organizationId);
    return successResponse(await updateModule(org, parsed.data, user, requestId), {
      message: "Pengaturan fitur berhasil diperbarui.",
    });
  } catch (error) {
    return handleRouteError("access.modules.update", error, requestId);
  }
}
