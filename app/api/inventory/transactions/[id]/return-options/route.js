import {requirePermission,resolvePermissionOrganization} from "@/lib/auth/permissions";
import {getRequestId,handleRouteError,successResponse,errorResponse} from "@/lib/api/routeHelpers";
import {returnSourceOptions} from "@/lib/inventory/transactionService";
import {z} from "zod";
export async function GET(request,{params}){
  const requestId=getRequestId(request);
  const {user,response}=await requirePermission("inventory.transactions.create");
  if(response)return response;
  try{
    const {id}=await params;
    const url=new URL(request.url);
    const warehouse=z.coerce.number().int().positive().safeParse(url.searchParams.get("warehouseId"));
    if(!z.uuid().safeParse(id).success || !warehouse.success)return errorResponse("VALIDATION_ERROR","Pilih gudang dan transaksi penyaluran yang valid.",400,requestId,{sourceTransactionId:"Pilih transaksi penyaluran sebelumnya."});
    const org=resolvePermissionOrganization(user,url.searchParams.get("organizationId"));
    return successResponse(await returnSourceOptions(org,user,id,warehouse.data));
  }catch(error){return handleRouteError("inventory.return.options",error,requestId);}
}
