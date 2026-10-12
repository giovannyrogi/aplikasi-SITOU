import { requirePermission, resolvePermissionOrganization } from "@/lib/auth/permissions";
import { getRequestId, handleRouteError, successResponse, errorResponse } from "@/lib/api/routeHelpers";
import { getTransaction } from "@/lib/inventory/transactionService";

export async function GET(request,{params}) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("inventory.transactions.read");
  if (response) return response;
  try {
    const { id } = await params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return errorResponse("INVALID_TRANSACTION_ID","Nomor transaksi tidak valid.",400,requestId);
    const organizationId = resolvePermissionOrganization(user,new URL(request.url).searchParams.get("organizationId"));
    return successResponse(await getTransaction(organizationId,user,id));
  } catch(error) { return handleRouteError("inventory.transactions.detail",error,requestId); }
}
