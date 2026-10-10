import { requirePermission, resolvePermissionOrganization } from "@/lib/auth/permissions";
import {
  getRequestId,
  handleRouteError,
  successResponse,
  readJson,
  readMultipartJson,
  validateMutationRequest,
  errorResponse,
} from "@/lib/api/routeHelpers";
import { parsePositiveInteger } from "@/app/utils/apiValidation";
import { catalogUpdateSchemas } from "@/lib/inventory/catalogSchemas";
import { assertCatalogKind, saveCatalog, assertCatalogWrite } from "@/lib/inventory/catalogService";
export async function PATCH(request, { params }) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("inventory.catalog.update");
  if (response) return response;
  const rejected = await validateMutationRequest(request, user.id, requestId, {
    maxBytes: 6 * 1024 * 1024,
  });
  if (rejected) return rejected;
  let parsed;
  try {
    const { kind, id } = await params;
    assertCatalogKind(kind);
    if (user.role_code !== "superadmin")
      await assertCatalogWrite(user, user.organization_id, "inventory.catalog.update");
    const checked = parsePositiveInteger(id, "ID katalog");
    if (checked.error) return errorResponse("INVALID_ID", checked.error, 400, requestId);
    parsed = request.headers.get("content-type")?.includes("multipart/form-data")
      ? await readMultipartJson(request, catalogUpdateSchemas[kind], requestId)
      : await readJson(request, catalogUpdateSchemas[kind], requestId);
    if (parsed.response) return parsed.response;
    const org = resolvePermissionOrganization(user, parsed.data.organizationId);
    return successResponse(
      await saveCatalog(
        kind,
        checked.value,
        { ...parsed.data, organizationId: org },
        user,
        requestId,
        parsed.file,
      ),
      { message: "Data katalog berhasil diperbarui." },
    );
  } catch (error) {
    return handleRouteError("inventory.catalog.update", error, requestId);
  } finally {
    await parsed?.cleanup?.();
  }
}
