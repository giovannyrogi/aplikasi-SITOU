import pool from "@/lib/dbConfig";
import {requirePermission,resolvePermissionOrganization} from "@/lib/auth/permissions";
import {getRequestId,successResponse,errorResponse,handleRouteError,validateMutationRequest} from "@/lib/api/routeHelpers";
import {writeAudit} from "@/lib/audit";
import {distributionSchema} from "@/lib/inventory/distributionPolicy.mjs";
import {distributionReport} from "@/lib/inventory/distributionService";
import {distributionWorkbook} from "@/lib/inventory/distributionExport.mjs";
/** Laporan dan ekspor memakai permission, scope, filter dan engine periode yang sama. */
export async function GET(request) {
  const requestId=getRequestId(request),{user,response}=await requirePermission("inventory.reports.read");if(response)return response;
  try {
    const params=Object.fromEntries(new URL(request.url).searchParams),exportAll=params.export==="xlsx",options=params.options==="1";delete params.export;delete params.options;
    params.organizationId=resolvePermissionOrganization(user,params.organizationId);
    const parsed=distributionSchema.safeParse(params);if(!parsed.success)return errorResponse("VALIDATION_ERROR",parsed.error.issues[0].message,400,requestId,Object.fromEntries(parsed.error.issues.map((i)=>[i.path.join("."),i.message])));
    if(exportAll){const rejected=await validateMutationRequest(request,user.id,requestId,{maxRequests:5,windowMs:300000,rateLimitAction:"inventory.distribution.export",rateLimitMessage:"Batas 5 ekspor dalam 5 menit tercapai. Coba lagi setelah masa tunggu berakhir."});if(rejected)return rejected;}
    const result=await distributionReport(parsed.data,user,{options,exportAll});
    const buffer=exportAll?await distributionWorkbook(result):null;
    if(exportAll||user.role_code==="superadmin")await writeAudit(pool,{organizationId:params.organizationId,actorUserId:user.id,action:exportAll?"inventory.distribution.export":"inventory.distribution.read",entityType:"inventory_distribution",entityId:result.filters?.to||"options",afterData:{filters:result.filters||parsed.data,rowCount:result.data?.length},requestId});
    if(!exportAll)return successResponse(result);
    const organizationCode=result.organization.code.replace(/[^a-zA-Z0-9_-]/g,"_")||String(params.organizationId);
    return new Response(buffer,{headers:{"Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","Content-Disposition":`attachment; filename="sitou-distribusi-${organizationCode}-${result.filters.from}-${result.filters.to}.xlsx"`,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
  }catch(error){return handleRouteError("inventory.distribution",error,requestId);}
}
