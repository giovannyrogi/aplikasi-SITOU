import { z } from "zod";
import { requirePermission,resolvePermissionOrganization } from "@/lib/auth/permissions";
import { getRequestId,handleRouteError,readJson,successResponse,validateMutationRequest } from "@/lib/api/routeHelpers";
import { openingCorrectionSchema } from "@/lib/inventory/transactionSchemas";
import { readOpening,previewOpening,correctOpening } from "@/lib/inventory/openingService";
const identity=z.object({organizationId:z.coerce.number().int().positive(),warehouseId:z.coerce.number().int().positive(),itemId:z.coerce.number().int().positive()});
const mutation=identity.extend({action:z.enum(["preview","correct"]),operationId:z.string().uuid(),correction:openingCorrectionSchema.omit({itemId:true})}).strict();
export async function GET(request) {
  const requestId=getRequestId(request),{user,response}=await requirePermission("inventory.transactions.read");
  if(response)return response;
  try {const input=identity.parse(Object.fromEntries(new URL(request.url).searchParams));
    return successResponse(await readOpening({...input,organizationId:resolvePermissionOrganization(user,input.organizationId)},user));
  }catch(error){return handleRouteError("inventory.openings.read",error,requestId);}
}
export async function POST(request) {
  const requestId=getRequestId(request),{user,response}=await requirePermission("inventory.openings.correct");
  if(response)return response;
  const rejected=await validateMutationRequest(request,user.id,requestId);if(rejected)return rejected;
  try {const parsed=await readJson(request,mutation,requestId);if(parsed.response)return parsed.response;
    const input={...parsed.data,organizationId:resolvePermissionOrganization(user,parsed.data.organizationId)};
    return successResponse(await (input.action==="preview"?previewOpening(input,user):correctOpening(input,user,requestId)));
  }catch(error){return handleRouteError("inventory.openings.mutate",error,requestId);}
}
