import { requirePermission } from "@/lib/auth/permissions";
import { errorResponse, getRequestId, handleRouteError, successResponse } from "@/lib/api/routeHelpers";
import { listBackupIssues } from "@/lib/system-backup/service";

/** Daftar temuan privat; tidak pernah mengirim object key atau path server. */
export async function GET(request, { params }) {
  const requestId = getRequestId(request);
  const { response } = await requirePermission("system_backup.manage");
  if (response) return response;
  try {
    const { id } = await params;
    const query = new URL(request.url).searchParams;
    const organizationId = query.get("organizationId");
    const priority = query.get("priority");
    const issueType = query.get("issueType");
    const cursor = query.get("cursor");
    if ((organizationId && (!/^[1-9]\d{0,18}$/.test(organizationId) ||
          BigInt(organizationId) > 9223372036854775807n)) ||
        (priority && !["restore", "cleanup_review"].includes(priority)) ||
        (issueType && !["missing", "size_mismatch", "hash_mismatch"].includes(issueType)) ||
        (cursor && cursor.length > 500))
      return errorResponse("BACKUP_ISSUE_FILTER_INVALID", "Filter temuan tidak valid.", 400, requestId);
    return successResponse(await listBackupIssues(id, { organizationId, priority, issueType, cursor }));
  } catch (error) {
    return handleRouteError("system-backup.issues", error, requestId);
  }
}
