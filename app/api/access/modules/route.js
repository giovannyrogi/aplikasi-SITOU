import { requirePermission, resolvePermissionOrganization } from "@/lib/auth/permissions";
import { readModule, readOrganizationModules } from "@/lib/access/packageRepository";
import { updateModule, updateModules } from "@/lib/access/packages";
import { moduleBatchSchema } from "@/lib/access/organizationModules.mjs";
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
  if (user.role_code !== "superadmin")
    return errorResponse(
      "FORBIDDEN",
      "Hanya Admin SITOU dapat mengatur fitur organisasi.",
      403,
      requestId,
    );
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
    const all = new URL(request.url).searchParams.get("view");
    if (all && all !== "all")
      return errorResponse("VALIDATION_ERROR", "Pilihan fitur tidak valid.", 400, requestId);
    if (all === "all") {
      return successResponse({ modules: await readOrganizationModules(org) });
    }
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
  const parsed = await readJson(request, moduleUpdateSchema.or(moduleBatchSchema), requestId);
  if (parsed.response) return parsed.response;
  try {
    const org = resolvePermissionOrganization(user, parsed.data.organizationId);
    const result = parsed.data.changes
      ? { modules: await updateModules(org, parsed.data.changes, user, requestId) }
      : await updateModule(org, parsed.data, user, requestId);
    return successResponse(result, {
      message: "Pengaturan fitur berhasil diperbarui.",
    });
  } catch (error) {
    return handleRouteError("access.modules.update", error, requestId);
  }
}
