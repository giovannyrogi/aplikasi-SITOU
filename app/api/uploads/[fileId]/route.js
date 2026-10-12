import pool from "@/lib/dbConfig";
import { writeAudit } from "@/lib/audit";
import {
  actorHasPermission,
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
import { requireAuthenticatedUser } from "@/app/utils/auth";
import { canUseHrisFile } from "@/lib/access/hrisPolicy.mjs";
import { requireInventoryAccess } from "@/lib/inventory/service";

/** Memeriksa scope pegawai untuk HRD dengan akses lokasi tertentu. */
async function enforceFileScope(user, file) {
  if (!["inventory_item_photo","inventory_transaction_attachment"].includes(file.category) && !canUseHrisFile(user,file.category))
    throw new ServiceError("FILE_FORBIDDEN","Akses ke jenis dokumen ini belum diberikan.",403);
  const categoryPermissions = {
    employee_import_source: "employee_import.read",
    discipline_letter: "discipline.read",
    contract: "contracts.read",
    assignment_decree: "assignments.read",
    leave_attachment: "leave_requests.read",
  };
  const categoryPermission = categoryPermissions[file.category];
  if (categoryPermission && !(await actorHasPermission(user, categoryPermission)))
    throw new ServiceError(
      "FILE_FORBIDDEN",
      "Anda tidak memiliki akses ke jenis file tersebut.",
      403,
    );
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
  const { user, response } = await requireAuthenticatedUser();
  if (response) return response;
  try {
    const { fileId } = await params;
    const organizationId = resolvePermissionOrganization(
      user,
      new URL(request.url).searchParams.get("organizationId"),
    );
    const sensitive = await actorHasPermission(user, "private_files.read_sensitive");
    if (!/^\d+$/.test(fileId)) throw new ServiceError("FILE_FORBIDDEN", "Anda tidak memiliki akses ke file tersebut.", 403);
    const file = await getStoredFile(fileId, organizationId);
    if (request.method === "DELETE" && !canUseHrisFile(user,file.category,true)) throw new ServiceError("FILE_FORBIDDEN","Pengubahan lampiran ini belum diberikan.",403);
    if (file.category === "inventory_item_photo") {
      await requireInventoryAccess(user, organizationId, "inventory.catalog.read");
      const referenced = await pool.query(
        "SELECT 1 FROM inventory_items WHERE organization_id=$1 AND photo_file_id=$2 LIMIT 1",
        [organizationId, file.id],
      );
      if (!referenced.rowCount)
        throw new ServiceError("FILE_FORBIDDEN", "Foto tidak digunakan oleh katalog barang.", 403);
    } else if (file.category === "inventory_transaction_attachment") {
      const linked = await pool.query(
        `SELECT tx.warehouse_id::text,tx.status,tx.created_by_user_id::text FROM inventory_transaction_files attachment
         JOIN inventory_transactions tx ON tx.organization_id=attachment.organization_id AND tx.id=attachment.transaction_id
         WHERE attachment.organization_id=$1 AND attachment.file_id=$2 AND (tx.status='posted' OR (tx.status='draft' AND tx.draft_discarded_at IS NULL AND tx.draft_expires_at>now())) LIMIT 1`,
        [organizationId,file.id],
      );
      if (!linked.rowCount) throw new ServiceError("FILE_FORBIDDEN", "Lampiran tidak terkait transaksi yang dapat dilihat.",403);
      if(linked.rows[0].status==='draft' && linked.rows[0].created_by_user_id!==String(user.id)) throw new ServiceError("FILE_FORBIDDEN","Lampiran draft hanya tersedia untuk pembuatnya.",403);
      await requireInventoryAccess(user,organizationId,linked.rows[0].status==='draft'?"inventory.transactions.create":"inventory.transactions.read",linked.rows[0].warehouse_id);
    } else if (!sensitive)
      throw new ServiceError("FILE_FORBIDDEN", "Anda tidak memiliki akses ke file tersebut.", 403);
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
  const rejected = await validateMutationRequest(request, user.id, requestId);
  if (rejected) return rejected;
  try {
    const { fileId } = await params;
    const organizationId = resolvePermissionOrganization(
      user,
      new URL(request.url).searchParams.get("organizationId"),
    );
    const file = await getStoredFile(fileId, organizationId);
    if (request.method === "DELETE" && !canUseHrisFile(user,file.category,true)) throw new ServiceError("FILE_FORBIDDEN","Pengubahan lampiran ini belum diberikan.",403);
    await enforceFileScope(user, file);
    if (file.category === "inventory_item_photo")
      throw new ServiceError(
        "INVENTORY_FILE_COMPOSITE_REQUIRED",
        "Hapus foto melalui form barang lalu simpan perubahan.",
        409,
      );
    if (file.category === "inventory_transaction_attachment")
      throw new ServiceError("INVENTORY_FILE_COMPOSITE_REQUIRED","Lampiran transaksi tidak dapat dihapus terpisah dari riwayatnya.",409);
    if (["employee_photo", "identity", "education", "inventory_item_photo"].includes(file.category))
      throw new ServiceError(
        "PROFILE_FILE_COMPOSITE_REQUIRED",
        "Hapus file profil melalui form data pegawai atau profil lengkap lalu simpan perubahan.",
        409,
      );
    await softDeleteStoredFile(fileId, organizationId, user, requestId);
    return successResponse(null, { code: "FILE_DELETED", message: "File berhasil dihapus." });
  } catch (error) {
    return handleRouteError("uploads.delete", error, requestId);
  }
}
