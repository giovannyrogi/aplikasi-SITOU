import { requirePermission } from "@/lib/auth/permissions";
import { getRequestId, handleRouteError, successResponse, validateMutationRequest } from "@/lib/api/routeHelpers";
import { deleteBackupFiles, getBackup } from "@/lib/system-backup/service";

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

/** Hanya Superadmin dapat menghapus byte backup; histori dan audit tetap disimpan. */
export async function DELETE(request, { params }) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("system_backup.manage");
  if (response) return response;
  const rejected = await validateMutationRequest(request, user.id, requestId,
    { rateLimitAction: "system-backup.delete", maxRequests: 10 });
  if (rejected) return rejected;
  try {
    const { id } = await params;
    const result = await deleteBackupFiles({ id, user, requestId });
    return successResponse(result.job, { message: result.cleanupPending
      ? "Akses unduh telah ditutup. Server akan mencoba membersihkan file backup yang masih tersisa."
      : "File backup berhasil dihapus. Riwayatnya tetap tersedia." });
  } catch (error) {
    return handleRouteError("system-backup.delete", error, requestId);
  }
}
