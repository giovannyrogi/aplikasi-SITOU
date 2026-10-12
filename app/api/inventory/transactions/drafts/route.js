import { requirePermission, resolvePermissionOrganization } from "@/lib/auth/permissions";
import { getRequestId, handleRouteError, successResponse, readJson, validateMutationRequest } from "@/lib/api/routeHelpers";
import { draftSchema } from "@/lib/inventory/transactionSchemas";
import { getLatestTransactionDraft, saveDraft } from "@/lib/inventory/transactionService";

export async function GET(request) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("inventory.transactions.create");
  if (response) return response;
  try {
    const organizationId = resolvePermissionOrganization(user,new URL(request.url).searchParams.get("organizationId"));
    return successResponse(await getLatestTransactionDraft(organizationId,user));
  } catch(error) { return handleRouteError("inventory.transactions.drafts.list",error,requestId); }
}

export async function POST(request) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("inventory.transactions.create");
  if (response) return response;
  const rejected = await validateMutationRequest(request,user.id,requestId,{maxBytes:128*1024});
  if (rejected) return rejected;
  try {
    const parsed = await readJson(request,draftSchema,requestId);
    if (parsed.response) return parsed.response;
    const organizationId = resolvePermissionOrganization(user,parsed.data.organizationId);
    return successResponse(await saveDraft({...parsed.data,organizationId},user,requestId),{message:"Draft tersimpan. Stok belum berubah."});
  } catch(error) { return handleRouteError("inventory.transactions.draft",error,requestId); }
}
