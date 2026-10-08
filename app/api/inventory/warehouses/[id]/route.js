import { requirePermission, resolvePermissionOrganization } from "@/lib/auth/permissions";
import { parsePositiveInteger } from "@/app/utils/apiValidation";
import { saveWarehouse } from "@/lib/inventory/service";
import { warehouseUpdateSchema } from "@/lib/inventory/schemas";
import {
  getRequestId,
  handleRouteError,
  readJson,
  successResponse,
  validateMutationRequest,
  errorResponse,
} from "@/lib/api/routeHelpers";
export async function PATCH(request, { params }) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("inventory.warehouses.update");
  if (response) return response;
  const rejected = await validateMutationRequest(request, user.id, requestId);
  if (rejected) return rejected;
  const id = parsePositiveInteger((await params).id, "Gudang");
  if (id.error) return errorResponse("INVALID_ID", id.error, 400, requestId);
  const parsed = await readJson(request, warehouseUpdateSchema, requestId);
  if (parsed.response) return parsed.response;
  try {
    const organizationId = resolvePermissionOrganization(user, parsed.data.organizationId);
    return successResponse(
      await saveWarehouse(id.value, { ...parsed.data, organizationId }, user, requestId),
      { message: "Gudang berhasil diperbarui." },
    );
  } catch (error) {
    return handleRouteError("inventory.warehouses.update", error, requestId);
  }
}
