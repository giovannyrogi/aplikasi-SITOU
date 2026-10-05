import { requirePermission } from "@/lib/auth/permissions";
import { retryBackupArtifact } from "@/lib/system-backup/service";
import { createBackupSchema } from "@/lib/system-backup/validation.mjs";
import { getRequestId, handleRouteError, readJson, successResponse, validateMutationRequest } from "@/lib/api/routeHelpers";

export async function POST(request, { params }) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("system_backup.manage");
  if (response) return response;
  const rejected = await validateMutationRequest(request, user.id, requestId,
    { rateLimitAction: "system-backup.artifact-retry", maxRequests: 5 });
  if (rejected) return rejected;
  const parsed = await readJson(request, createBackupSchema, requestId);
  if (parsed.response) return parsed.response;
  try {
    const { id, kind } = await params;
    const job = await retryBackupArtifact({ id, kind, user, password: parsed.data.password, requestId });
    return successResponse(job, { status: 202, message: "Pembuatan ZIP dimulai. Muat ulang untuk melihat hasilnya." });
  } catch (error) { return handleRouteError("system-backup.artifact-retry", error, requestId); }
}
