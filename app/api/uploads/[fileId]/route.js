import pool from "@/lib/dbConfig";
import { writeAudit } from "@/lib/audit";
import {
  requirePermission,
  resolvePermissionOrganization,
  ensureActorEmployeeAccess,
} from "@/lib/auth/permissions";
import {
  getRequestId,
  handleRouteError,
  ServiceError,
  successResponse,
  validateMutationRequest,
} from "@/lib/api/routeHelpers";
import {
  assertStoredFileAvailable,
  createStoredFileStream,
  getStoredFile,
  sanitizeDownloadName,
  softDeleteStoredFile,
} from "@/lib/files/storage";
import { canViewDraftDisciplinaryActions } from "@/lib/discipline/visibility.mjs";

/** Memeriksa scope pegawai untuk HRD dengan akses lokasi tertentu. */
async function enforceFileScope(user, file) {
  if (file.onboarding_draft_id) {
    const draft = await pool.query(
      `SELECT 1 FROM employee_onboarding_drafts
       WHERE id=$1 AND organization_id=$2 AND created_by_user_id=$3
         AND status IN ('active','finalizing','completed')`,
      [file.onboarding_draft_id, file.organization_id, user.id],
    );
    if (!draft.rows[0])
      throw new ServiceError("FILE_FORBIDDEN", "Anda tidak memiliki akses ke file tersebut.", 403);
    return;
  }
  if (file.category === "discipline_letter" && !canViewDraftDisciplinaryActions(user)) {
    const draftAction = await pool.query(
      `SELECT 1 FROM disciplinary_actions
       WHERE organization_id=$1 AND document_file_id=$2 AND status='draft'
       LIMIT 1`,
      [file.organization_id, file.id],
    );
    if (draftAction.rows[0])
      throw new ServiceError(
        "FILE_FORBIDDEN",
        "Surat tindakan draft hanya dapat diakses oleh pengelola disiplin.",
        403,
      );
  }
  if (!file.employee_id) return;
  await ensureActorEmployeeAccess(user, file.employee_id, file.organization_id);
}

/** Melakukan stream file privat berdasarkan ID setelah authorization dan audit. */
export async function GET(request, { params }) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("private_files.read_sensitive");
  if (response) return response;
  try {
    const { fileId } = await params;
    const organizationId = resolvePermissionOrganization(
      user,
      new URL(request.url).searchParams.get("organizationId"),
    );
    const file = await getStoredFile(fileId, organizationId);
    await enforceFileScope(user, file);
    await assertStoredFileAvailable(file);
    const mode =
      new URL(request.url).searchParams.get("download") === "1" ? "attachment" : "inline";
    await writeAudit(pool, {
      organizationId,
      actorUserId: user.id,
      action: mode === "inline" ? "private_file.preview" : "private_file.download",
      entityType: "stored_file",
      entityId: file.id,
      afterData: { employeeId: file.employee_id, category: file.category },
      requestId,
    });
    return new Response(createStoredFileStream(file), {
      headers: {
        "Content-Type": file.mime_type,
        "Content-Length": String(file.size_bytes),
        "Content-Disposition": `${mode}; filename="${sanitizeDownloadName(file.original_name)}"`,
        "Cache-Control": "private, no-store",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return handleRouteError("uploads.read", error, requestId);
  }
}

/** Menandai metadata file terhapus tanpa menghilangkan bukti secara fisik. */
export async function DELETE(request, { params }) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("private_files.manage");
  if (response) return response;
  const rejected = validateMutationRequest(request, user.id, requestId);
  if (rejected) return rejected;
  try {
    const { fileId } = await params;
    const organizationId = resolvePermissionOrganization(
      user,
      new URL(request.url).searchParams.get("organizationId"),
    );
    const file = await getStoredFile(fileId, organizationId);
    await enforceFileScope(user, file);
    await softDeleteStoredFile(fileId, organizationId, user, requestId);
    return successResponse(null, { code: "FILE_DELETED", message: "File berhasil dihapus." });
  } catch (error) {
    return handleRouteError("uploads.delete", error, requestId);
  }
}
