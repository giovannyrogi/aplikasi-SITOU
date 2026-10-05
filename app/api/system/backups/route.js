import { requirePermission } from "@/lib/auth/permissions";
import { createBackup, estimateBackup, listBackups } from "@/lib/system-backup/service";
import { createBackupSchema } from "@/lib/system-backup/validation.mjs";
import { getRequestId, handleRouteError, readJson, successResponse, validateMutationRequest } from "@/lib/api/routeHelpers";

/** Hanya Superadmin menerima histori dan perkiraan cakupan backup. */
export async function GET(request) {
  const requestId = getRequestId(request);
  const { response } = await requirePermission("system_backup.manage");
  if (response) return response;
  try {
    const parameters = new URL(request.url).searchParams;
    const includeEstimate = parameters.get("estimate") !== "0";
    const [history, estimate] = await Promise.all([listBackups(parameters.get("cursor")),
      includeEstimate ? estimateBackup() : null]);
    return successResponse({ jobs: history.rows, nextCursor: history.nextCursor, estimate });
  } catch (error) {
    return handleRouteError("system-backup.list", error, requestId);
  }
}

/** Memulai pekerjaan manual tanpa menyimpan kata sandi pada database. */
export async function POST(request) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("system_backup.manage");
  if (response) return response;
  const rejected = await validateMutationRequest(request, user.id, requestId, { rateLimitAction: "system-backup.create", maxRequests: 5 });
  if (rejected) return rejected;
  const parsed = await readJson(request, createBackupSchema, requestId);
  if (parsed.response) return parsed.response;
  try {
    const job = await createBackup({ user, password: parsed.data.password, requestId });
    return successResponse(job, { status: ["ready", "ready_with_warnings"].includes(job.status) ? 200 : 202,
      message: ["ready", "ready_with_warnings"].includes(job.status)
        ? "Backup dari permintaan ini sudah siap diunduh."
        : "Backup dimulai. Simpan kata sandi Anda dengan aman." });
  } catch (error) {
    return handleRouteError("system-backup.create", error, requestId);
  }
}
