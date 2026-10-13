import {requirePermission,resolvePermissionOrganization} from "@/lib/auth/permissions";
import {getRequestId,handleRouteError,readJson,successResponse,validateMutationRequest} from "@/lib/api/routeHelpers";
import {transactionSchema} from "@/lib/inventory/transactionSchemas";
import {previewTransaction} from "@/lib/inventory/transactionService";
export async function POST(request){
  const requestId=getRequestId(request);
  const {user,response}=await requirePermission("inventory.transactions.create");
  if(response)return response;
  const rejected=await validateMutationRequest(request,requestId);
  if(rejected)return rejected;
  try{
    const parsed=await readJson(request,transactionSchema,requestId);
    if(parsed.response)return parsed.response;
    const organizationId=resolvePermissionOrganization(user,parsed.data.organizationId);
    return successResponse(await previewTransaction({...parsed.data,organizationId},user));
  }catch(error){return handleRouteError("inventory.transactions.preview",error,requestId);}
}
