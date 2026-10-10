import { requirePermission, resolvePermissionOrganization } from "@/lib/auth/permissions";
import {
  getRequestId,
  handleRouteError,
  successResponse,
  parseListQuery,
  readJson,
  readMultipartJson,
  validateMutationRequest,
  errorResponse,
} from "@/lib/api/routeHelpers";
import { catalogSchemas } from "@/lib/inventory/catalogSchemas";
import {
  assertCatalogKind,
  listCatalog,
  catalogOptions,
  saveCatalog,
  assertCatalogWrite,
} from "@/lib/inventory/catalogService";
export async function GET(request, { params }) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("inventory.catalog.read");
  if (response) return response;
  try {
    const { kind } = await params;
    assertCatalogKind(kind);
    const url = new URL(request.url);
    const organizationId = resolvePermissionOrganization(
      user,
      url.searchParams.get("organizationId"),
    );
    if (url.searchParams.get("options") === "1")
      return successResponse(await catalogOptions(organizationId, user));
    const query = parseListQuery(url.searchParams);
    if (!["all", "active", "inactive"].includes(query.status))
      return errorResponse("INVALID_STATUS", "Status tidak valid.", 400, requestId);
    const result = await listCatalog(kind, { ...query, organizationId }, user);
    return successResponse(result.data, {
      pagination: { page: query.page, pageSize: query.pageSize, total: result.total },
    });
  } catch (error) {
    return handleRouteError("inventory.catalog.list", error, requestId);
  }
}
export async function POST(request, { params }) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("inventory.catalog.create");
  if (response) return response;
  const rejected = await validateMutationRequest(request, user.id, requestId, {
    maxBytes: 6 * 1024 * 1024,
  });
  if (rejected) return rejected;
  let parsed;
  try {
    const { kind } = await params;
    assertCatalogKind(kind);
    if (user.role_code !== "superadmin")
      await assertCatalogWrite(user, user.organization_id, "inventory.catalog.create");
    parsed = request.headers.get("content-type")?.includes("multipart/form-data")
      ? await readMultipartJson(request, catalogSchemas[kind], requestId)
      : await readJson(request, catalogSchemas[kind], requestId);
    if (parsed.response) return parsed.response;
    const org = resolvePermissionOrganization(user, parsed.data.organizationId);
    return successResponse(
      await saveCatalog(
        kind,
        null,
        { ...parsed.data, organizationId: org },
        user,
        requestId,
        parsed.file,
      ),
      { status: 201, message: "Data katalog berhasil ditambahkan." },
    );
  } catch (error) {
    return handleRouteError("inventory.catalog.create", error, requestId);
  } finally {
    await parsed?.cleanup?.();
  }
}
