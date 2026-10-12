import { requirePermission, resolvePermissionOrganization } from "@/lib/auth/permissions";
import { getRequestId, handleRouteError, successResponse, errorResponse, validateMutationRequest } from "@/lib/api/routeHelpers";
import { parseMultipartToPrivateTemp } from "@/lib/api/multipart";
import { storeTransactionDraftFile } from "@/lib/inventory/transactionService";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function POST(request,{params}) {
  const requestId=getRequestId(request);
  const {user,response}=await requirePermission("inventory.transactions.create");
  if(response)return response;
  const rejected=await validateMutationRequest(request,user.id,requestId,{maxBytes:11*1024*1024});
  if(rejected)return rejected;
  let form;
  try {
    const {id}=await params;
    if(!uuid.test(id))return errorResponse("INVALID_DRAFT","Draft tidak valid.",400,requestId);
    form=await parseMultipartToPrivateTemp(request);
    if([...form.keys()].some((key)=>!["organizationId","purpose","file"].includes(key))||form.getAll("file").length!==1||form.getAll("purpose").length!==1)
      return errorResponse("INVALID_FORM_FIELD","Lampiran draft tidak lengkap.",400,requestId);
    const organizationId=resolvePermissionOrganization(user,form.get("organizationId"));
    const data=await storeTransactionDraftFile({organizationId,transactionId:id,purpose:String(form.get("purpose")),file:form.get("file"),actor:user,requestId});
    return successResponse(data,{status:201,message:"Lampiran draft tersimpan secara privat."});
  }catch(error){return handleRouteError("inventory.transaction.draft-file",error,requestId);}
  finally{await form?.cleanup?.();}
}
