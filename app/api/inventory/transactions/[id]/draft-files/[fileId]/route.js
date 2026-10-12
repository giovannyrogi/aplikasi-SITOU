import { requirePermission, resolvePermissionOrganization } from "@/lib/auth/permissions";
import { getRequestId, handleRouteError, successResponse, errorResponse, validateMutationRequest } from "@/lib/api/routeHelpers";
import { removeTransactionDraftFile } from "@/lib/inventory/transactionService";

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function DELETE(request,{params}) {
  const requestId=getRequestId(request);
  const {user,response}=await requirePermission("inventory.transactions.create");
  if(response)return response;
  const rejected=await validateMutationRequest(request,user.id,requestId);
  if(rejected)return rejected;
  try {
    const {id,fileId}=await params;
    if(!uuid.test(id)||!/^[1-9]\d*$/.test(fileId))return errorResponse("INVALID_FILE","Lampiran draft tidak valid.",400,requestId);
    const organizationId=resolvePermissionOrganization(user,new URL(request.url).searchParams.get("organizationId"));
    await removeTransactionDraftFile({organizationId,transactionId:id,fileId,actor:user,requestId});
    return successResponse(null,{message:"Lampiran draft dihapus."});
  }catch(error){return handleRouteError("inventory.transaction.draft-file-remove",error,requestId);}
}
