import pool from "@/lib/dbConfig";
import { writeAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/permissions";
import { getRequestId, handleRouteError } from "@/lib/api/routeHelpers";
import { getSelfProfilePhoto } from "@/lib/files/selfProfilePhoto";
import {
  assertStoredFileAvailable,
  createStoredFileStream,
  sanitizeDownloadName,
} from "@/lib/files/storage";

/** Preview pas foto akun sendiri; tidak menerima target pegawai atau organisasi. */
export async function GET(request) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("profile_self.read");
  if (response) return response;
  try {
    const file = await getSelfProfilePhoto(user);
    await assertStoredFileAvailable(file);
    await writeAudit(pool, {
      organizationId: user.organization_id,
      actorUserId: user.id,
      action: "private_file.preview",
      entityType: "stored_file",
      entityId: file.id,
      afterData: { employeeId: file.employee_id, category: file.category },
      requestId,
    });
    return new Response(createStoredFileStream(file), {
      headers: {
        "Content-Type": file.mime_type,
        "Content-Length": String(file.size_bytes),
        "Content-Disposition": `inline; filename="${sanitizeDownloadName(file.original_name)}"`,
        "Cache-Control": "private, no-store",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return handleRouteError("uploads.profile_self", error, requestId);
  }
}
