import { requirePermission, resolvePermissionOrganization } from "@/lib/auth/permissions";
import { getRequestId, handleRouteError, successResponse, errorResponse } from "@/lib/api/routeHelpers";
import { stockFiltersSchema, stockHistorySchema } from "@/lib/inventory/stockSchemas";
import { listStock, stockHistory } from "@/lib/inventory/stockService";

export async function GET(request) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("inventory.stock.read");
  if (response) return response;
  try {
    const params = Object.fromEntries(new URL(request.url).searchParams);
    const history = params.action === "history";
    delete params.action;
    params.organizationId = resolvePermissionOrganization(user,params.organizationId);
    const parsed = (history ? stockHistorySchema : stockFiltersSchema).safeParse(params);
    if (!parsed.success) return errorResponse("VALIDATION_ERROR","Periksa filter stok barang.",400,requestId,
      Object.fromEntries(parsed.error.issues.map((issue)=>[issue.path.join("."),issue.message])));
    const input = parsed.data;
    return successResponse(await (history ? stockHistory(input,user) : listStock(input,user)));
  } catch (error) { return handleRouteError("inventory.stock.read",error,requestId); }
}
