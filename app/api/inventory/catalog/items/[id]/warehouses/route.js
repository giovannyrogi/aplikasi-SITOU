import { requirePermission, resolvePermissionOrganization } from "@/lib/auth/permissions";
import {
  getRequestId,
  handleRouteError,
  successResponse,
  readJson,
  validateMutationRequest,
  errorResponse,
} from "@/lib/api/routeHelpers";
import { parsePositiveInteger } from "@/app/utils/apiValidation";
import { itemWarehouseSchema } from "@/lib/inventory/catalogSchemas";
import { listItemWarehouses, saveItemWarehouse } from "@/lib/inventory/catalogService";
export async function GET(request, { params }) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("inventory.catalog.read");
  if (response) return response;
  try {
    const id = parsePositiveInteger((await params).id, "Barang");
    if (id.error) return errorResponse("INVALID_ID", id.error, 400, requestId);
    const org = resolvePermissionOrganization(
      user,
      new URL(request.url).searchParams.get("organizationId"),
    );
    return successResponse(await listItemWarehouses(org, id.value, user));
  } catch (error) {
    return handleRouteError("inventory.item_warehouses.read", error, requestId);
  }
}
export async function PUT(request, { params }) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("inventory.item_warehouses.update");
  if (response) return response;
  const rejected = await validateMutationRequest(request, user.id, requestId);
  if (rejected) return rejected;
  const parsed = await readJson(request, itemWarehouseSchema, requestId);
  if (parsed.response) return parsed.response;
  try {
    const id = parsePositiveInteger((await params).id, "Barang");
    if (id.error) return errorResponse("INVALID_ID", id.error, 400, requestId);
    const org = resolvePermissionOrganization(user, parsed.data.organizationId);
    return successResponse(await saveItemWarehouse(org, id.value, parsed.data, user, requestId), {
      message: "Pengaturan barang di gudang berhasil disimpan.",
    });
  } catch (error) {
    return handleRouteError("inventory.item_warehouses.update", error, requestId);
  }
}
