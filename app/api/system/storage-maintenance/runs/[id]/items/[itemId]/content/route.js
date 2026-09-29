import { requirePermission, resolvePermissionOrganization } from "@/lib/auth/permissions";
import { getRequestId, handleRouteError } from "@/lib/api/routeHelpers";
import { sanitizeDownloadName } from "@/lib/files/storage";
import { getMaintenanceItemContent } from "@/lib/storage-maintenance/service";

export async function GET(request, context) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("storage_maintenance.manage");
  if (response) return response;
  try {
    const { id, itemId } = await context.params;
    const params = new URL(request.url).searchParams;
    const organizationId = resolvePermissionOrganization(user, params.get("organizationId"));
    const download = params.get("download") === "1";
    const file = await getMaintenanceItemContent(
      id,
      itemId,
      organizationId,
      user,
      requestId,
      { download },
    );
    return new Response(file.buffer, {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Length": String(file.buffer.length),
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${sanitizeDownloadName(file.originalName)}"`,
        "Cache-Control": "private, no-store",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return handleRouteError("storage-maintenance.content", error, requestId);
  }
}
