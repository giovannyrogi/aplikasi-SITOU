import { requirePermission, resolvePermissionOrganization } from "@/lib/auth/permissions";
import { listWarehouses, saveWarehouse, getWarehouseLocations } from "@/lib/inventory/service";
import { warehouseSchema } from "@/lib/inventory/schemas";
import { parsePositiveInteger } from "@/app/utils/apiValidation";
import {
  getRequestId,
  handleRouteError,
  parseListQuery,
  readJson,
  successResponse,
  validateMutationRequest,
  errorResponse,
} from "@/lib/api/routeHelpers";
export async function GET(request) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("inventory.warehouses.read");
  if (response) return response;
  try {
    const url = new URL(request.url);
    if (url.searchParams.has("organizationId")) {
      const requested = parsePositiveInteger(url.searchParams.get("organizationId"), "Organisasi");
      if (requested.error)
        return errorResponse("INVALID_ORGANIZATION", requested.error, 400, requestId, {
          organizationId: requested.error,
        });
    }
    const organizationId = resolvePermissionOrganization(
      user,
      url.searchParams.get("organizationId"),
    );
    if (url.searchParams.get("options") === "1")
      return successResponse(await getWarehouseLocations(organizationId, user));
    const query = parseListQuery(url.searchParams);
    if (!["all", "active", "inactive"].includes(query.status))
      return errorResponse("INVALID_STATUS", "Status gudang tidak valid.", 400, requestId);
    const result = await listWarehouses({ ...query, organizationId }, user);
    return successResponse(result.data, {
      pagination: { page: query.page, pageSize: query.pageSize, total: result.total },
    });
  } catch (error) {
    return handleRouteError("inventory.warehouses.list", error, requestId);
  }
}
export async function POST(request) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("inventory.warehouses.create");
  if (response) return response;
  const rejected = await validateMutationRequest(request, user.id, requestId);
  if (rejected) return rejected;
  const parsed = await readJson(request, warehouseSchema, requestId);
  if (parsed.response) return parsed.response;
  try {
    const organizationId = resolvePermissionOrganization(user, parsed.data.organizationId);
    return successResponse(
      await saveWarehouse(null, { ...parsed.data, organizationId }, user, requestId),
      { status: 201, message: "Gudang berhasil ditambahkan." },
    );
  } catch (error) {
    return handleRouteError("inventory.warehouses.create", error, requestId);
  }
}
