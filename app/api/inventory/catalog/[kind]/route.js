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
    const itemFilters = {};
    if (kind === "items") {
      const warehouseId = url.searchParams.get("warehouseId") || "";
      const locationId = url.searchParams.get("locationId") || "";
      if (warehouseId && warehouseId !== "unregistered" && !/^[1-9]\d*$/.test(warehouseId))
        return errorResponse("INVALID_WAREHOUSE", "Pilih gudang yang tersedia.", 400, requestId, {
          warehouseId: "Gudang tidak valid.",
        });
      if (locationId && !/^[1-9]\d*$/.test(locationId))
        return errorResponse("INVALID_LOCATION", "Pilih lokasi yang tersedia.", 400, requestId, {
          locationId: "Lokasi tidak valid.",
        });
      itemFilters.warehouseId = warehouseId;
      itemFilters.locationId = locationId;
      for (const key of ["minimumFrom", "minimumTo"]) {
        const raw = url.searchParams.get(key);
        if (raw !== null && raw !== "") {
          if (!/^(?:0|[1-9]\d{0,11})(?:\.\d{1,3})?$/.test(raw))
            return errorResponse(
              "INVALID_MINIMUM",
              "Masukkan batas minimum stok yang valid.",
              400,
              requestId,
              {
                [key]: "Gunakan angka 0–999999999999 dengan maksimal tiga desimal.",
              },
            );
          itemFilters[key] = Number(raw);
        }
      }
      if (
        itemFilters.minimumFrom !== undefined &&
        itemFilters.minimumTo !== undefined &&
        itemFilters.minimumFrom > itemFilters.minimumTo
      )
        return errorResponse(
          "INVALID_MINIMUM_RANGE",
          "Nilai minimum awal tidak boleh melebihi nilai akhir.",
          400,
          requestId,
          {
            minimumTo: "Gunakan nilai yang sama atau lebih besar dari batas awal.",
          },
        );
      if (
        warehouseId === "unregistered" &&
        (locationId || itemFilters.minimumFrom !== undefined || itemFilters.minimumTo !== undefined)
      )
        return errorResponse(
          "INVALID_FILTER_COMBINATION",
          "Barang yang belum didaftarkan tidak memiliki lokasi atau batas stok minimum.",
          400,
          requestId,
        );
    }
    const result = await listCatalog(kind, { ...query, ...itemFilters, organizationId }, user);
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
