import { requirePermission, resolvePermissionOrganization } from "@/lib/auth/permissions";
import { getRequestId, handleRouteError, successResponse, readJson, validateMutationRequest, errorResponse } from "@/lib/api/routeHelpers";
import { cancellationSchema } from "@/lib/inventory/transactionSchemas";
import { cancelTransaction } from "@/lib/inventory/transactionService";

export async function POST(request,{params}) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("inventory.transactions.cancel");
  if (response) return response;
  const rejected = await validateMutationRequest(request,user.id,requestId);
  if (rejected) return rejected;
  try {
    const { id } = await params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return errorResponse("INVALID_TRANSACTION_ID","Nomor transaksi tidak valid.",400,requestId);
    const parsed = await readJson(request,cancellationSchema,requestId);
    if (parsed.response) return parsed.response;
    const organizationId = resolvePermissionOrganization(user,parsed.data.organizationId);
    return successResponse(await cancelTransaction(organizationId,id,parsed.data.reason,parsed.data.reversalId,user,requestId),{message:"Transaksi dibatalkan. Perubahan stok pembalik sudah dicatat."});
  } catch(error) { return handleRouteError("inventory.transactions.cancel",error,requestId); }
}
