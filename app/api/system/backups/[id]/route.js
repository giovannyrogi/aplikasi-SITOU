import { requirePermission } from "@/lib/auth/permissions";
import { getRequestId, handleRouteError, successResponse } from "@/lib/api/routeHelpers";
import { getBackup } from "@/lib/system-backup/service";

/** Polling satu pekerjaan tetap melewati izin platform. */
export async function GET(request, { params }) {
  const requestId = getRequestId(request);
  const { response } = await requirePermission("system_backup.manage");
  if (response) return response;
  try {
    const { id } = await params;
    return successResponse(await getBackup(id));
  } catch (error) {
    return handleRouteError("system-backup.detail", error, requestId);
  }
}
