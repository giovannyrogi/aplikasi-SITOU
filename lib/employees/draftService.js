import pool from "@/lib/dbConfig";
import { withTransaction } from "@/lib/dbTransaction";
import { writeAudit } from "@/lib/audit";
import { ServiceError } from "@/lib/api/routeHelpers";
import { employeeCreateSchema } from "@/lib/employees/schemas";
import {
  createEmployeeInTransaction,
  getEmployee,
  mapEmployeeConstraintError,
} from "@/lib/employees/service";
import { listEmployeeDraftFiles, promoteEmployeeDraftFiles } from "@/lib/files/storage";

const DRAFT_TTL_DAYS = 7;

const normalizeLegacyLeaveStatus = (payload = {}) =>
  payload.employmentStatus === "leave" ? { ...payload, employmentStatus: "active" } : payload;

/** Membentuk respons draft tanpa membocorkan object key maupun payload ke log. */
async function presentDraft(row, database = pool) {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    status: row.status,
    currentStep: row.current_step,
    payload: normalizeLegacyLeaveStatus(row.payload || {}),
    version: row.version,
    expiresAt: row.expires_at,
    updatedAt: row.updated_at,
    files: await listEmployeeDraftFiles(
      row.id,
      row.organization_id,
      row.created_by_user_id,
      database,
    ),
  };
}

/** Mengambil draft aktif actor dan menandai draft yang melewati retensi sebagai expired. */
export async function getActiveEmployeeDraft(organizationId, actor) {
  await pool.query(
    `UPDATE employee_onboarding_drafts SET status='expired'
     WHERE organization_id=$1 AND created_by_user_id=$2 AND status='active' AND expires_at<=now()`,
    [organizationId, actor.id],
  );
  const result = await pool.query(
    `SELECT * FROM employee_onboarding_drafts
     WHERE organization_id=$1 AND created_by_user_id=$2 AND status IN ('active','finalizing')
     ORDER BY updated_at DESC LIMIT 1`,
    [organizationId, actor.id],
  );
  return result.rows[0] ? presentDraft(result.rows[0]) : null;
}

/** Membuat satu draft aktif per actor dan organisasi secara aman terhadap request bersamaan. */
export async function createEmployeeDraft(organizationId, actor, requestId) {
  return withTransaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock($1::int,$2::int)", [organizationId, actor.id]);
    const existing = await client.query(
      `SELECT * FROM employee_onboarding_drafts
       WHERE organization_id=$1 AND created_by_user_id=$2 AND status IN ('active','finalizing')
       ORDER BY updated_at DESC LIMIT 1`,
      [organizationId, actor.id],
    );
    if (existing.rows[0]) return presentDraft(existing.rows[0], client);
    const inserted = await client.query(
      `INSERT INTO employee_onboarding_drafts
        (organization_id,created_by_user_id,expires_at)
       VALUES ($1,$2,now()+($3||' days')::interval) RETURNING *`,
      [organizationId, actor.id, DRAFT_TTL_DAYS],
    );
    await writeAudit(client, {
      organizationId,
      actorUserId: actor.id,
      action: "employee_draft.create",
      entityType: "employee_onboarding_draft",
      entityId: inserted.rows[0].id,
      afterData: { expiresInDays: DRAFT_TTL_DAYS },
      requestId,
    });
    return presentDraft(inserted.rows[0], client);
  });
}

/** Autosave memakai version check agar tab lama tidak menimpa perubahan yang lebih baru. */
export async function saveEmployeeDraft(input, actor, requestId) {
  const result = await pool.query(
    `UPDATE employee_onboarding_drafts
     SET payload=$5::jsonb,current_step=$4,version=version+1,
         expires_at=now()+($6||' days')::interval
     WHERE id=$1 AND organization_id=$2 AND created_by_user_id=$3
       AND status='active' AND version=$7 AND expires_at>now()
     RETURNING *`,
    [
      input.id,
      input.organizationId,
      actor.id,
      input.currentStep,
      JSON.stringify(normalizeLegacyLeaveStatus(input.payload)),
      DRAFT_TTL_DAYS,
      input.version,
    ],
  );
  if (!result.rows[0])
    throw new ServiceError(
      "DRAFT_VERSION_CONFLICT",
      "Draft telah berubah di sesi lain. Muat ulang sebelum melanjutkan.",
      409,
    );
  return presentDraft(result.rows[0]);
}

/** Discard mempertahankan metadata untuk retention tetapi menghilangkannya dari workflow aktif. */
export async function discardEmployeeDraft(draftId, organizationId, actor, requestId) {
  return withTransaction(async (client) => {
    const discarded = await client.query(
      `UPDATE employee_onboarding_drafts SET status='discarded',version=version+1
       WHERE id=$1 AND organization_id=$2 AND created_by_user_id=$3 AND status='active'
       RETURNING id`,
      [draftId, organizationId, actor.id],
    );
    if (!discarded.rows[0])
      throw new ServiceError("DRAFT_NOT_FOUND", "Draft pegawai tidak ditemukan.", 404);
    await client.query(
      `UPDATE stored_files SET deleted_at=now()
       WHERE organization_id=$1 AND onboarding_draft_id=$2 AND deleted_at IS NULL`,
      [organizationId, draftId],
    );
    await writeAudit(client, {
      organizationId,
      actorUserId: actor.id,
      action: "employee_draft.discard",
      entityType: "employee_onboarding_draft",
      entityId: draftId,
      requestId,
    });
  });
}

/** Memuat dokumen opsional yang akan dikaitkan ketika draft difinalisasi. */
async function loadDraftDocuments(client, draft) {
  const files = await client.query(
    `SELECT id::text,object_key,mime_type,category FROM stored_files
     WHERE organization_id=$1 AND onboarding_draft_id=$2 AND deleted_at IS NULL
       AND category IN ('employee_photo','identity','education','contract','assignment_decree') FOR UPDATE`,
    [draft.organization_id, draft.id],
  );
  const byCategory = new Map(files.rows.map((file) => [file.category, file]));
  return { files: files.rows, byCategory };
}

/** Finalisasi draft bersifat idempotent dan membuat semua record awal dalam satu transaksi. */
export async function submitEmployeeDraft(draftId, organizationId, actor, requestId) {
  let promotionFiles = [];
  let employee;
  try {
    employee = await withTransaction(async (client) => {
      const result = await client.query(
        `SELECT * FROM employee_onboarding_drafts
         WHERE id=$1 AND organization_id=$2 AND created_by_user_id=$3 FOR UPDATE`,
        [draftId, organizationId, actor.id],
      );
      const draft = result.rows[0];
      if (!draft) throw new ServiceError("DRAFT_NOT_FOUND", "Draft pegawai tidak ditemukan.", 404);
      if (draft.status === "completed" && draft.submitted_employee_id) {
        // Retry finalisasi juga merapikan file yang tertinggal bila promosi sebelumnya tertunda.
        const pendingFiles = await client.query(
          `SELECT id::text,object_key,mime_type,category FROM stored_files
           WHERE organization_id=$1 AND onboarding_draft_id=$2 AND deleted_at IS NULL
             AND category IN ('employee_photo','identity','education','contract','assignment_decree') FOR UPDATE`,
          [organizationId, draft.id],
        );
        promotionFiles = pendingFiles.rows;
        return getEmployee(draft.submitted_employee_id, organizationId, client);
      }
      if (draft.status !== "active" || draft.expires_at <= new Date())
        throw new ServiceError("DRAFT_NOT_ACTIVE", "Draft tidak lagi aktif.", 409);

      const documents = await loadDraftDocuments(client, draft);
      const educationFile = documents.byCategory.get("education");
      const draftProfile = draft.payload.profile || {};
      const normalizedPayload = normalizeLegacyLeaveStatus(draft.payload);
      const parsed = employeeCreateSchema.safeParse({
        ...normalizedPayload,
        organizationId,
        profilePhotoFileId: documents.byCategory.get("employee_photo")?.id || null,
        profile: {
          ...draftProfile,
          educations: (draftProfile.educations || []).map((education, index) => ({
            ...education,
            certificateFileId: index === 0 ? educationFile?.id || null : null,
          })),
        },
        contract: {
          ...normalizedPayload.contract,
          status: "active",
          documentFileId: documents.byCategory.get("contract")?.id || null,
        },
        assignment: {
          ...normalizedPayload.assignment,
          assignmentType: "primary",
          changeType: "initial",
          documentFileId: documents.byCategory.get("assignment_decree")?.id || null,
        },
      });
      if (!parsed.success) {
        const fieldErrors = {};
        for (const issue of parsed.error.issues)
          fieldErrors[issue.path.join(".")] ||= issue.message;
        throw new ServiceError(
          "VALIDATION_ERROR",
          "Periksa kembali data pada seluruh langkah.",
          400,
          fieldErrors,
        );
      }
      if (parsed.data.employmentStatus === "draft")
        throw new ServiceError(
          "EMPLOYEE_STATUS_INVALID",
          "Gunakan draft otomatis untuk data yang belum siap disimpan.",
          400,
          { employmentStatus: "Status Draft tidak digunakan pada penyimpanan final." },
        );

      await client.query("UPDATE employee_onboarding_drafts SET status='finalizing' WHERE id=$1", [
        draft.id,
      ]);
      const created = await createEmployeeInTransaction(client, parsed.data, actor, requestId, {
        draftId: draft.id,
      });
      const ktpFile = documents.byCategory.get("identity");
      if (ktpFile)
        await client.query(
          `INSERT INTO employee_documents (organization_id,employee_id,document_type,file_id)
           VALUES ($1,$2,'ktp',$3)`,
          [organizationId, created.id, ktpFile.id],
        );
      await client.query(
        `UPDATE employee_onboarding_drafts
         SET status='completed',submitted_employee_id=$2,version=version+1
         WHERE id=$1`,
        [draft.id, created.id],
      );
      promotionFiles = documents.files;
      return created;
    });
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    mapEmployeeConstraintError(error);
  }

  if (promotionFiles.length)
    await promoteEmployeeDraftFiles(promotionFiles, organizationId, draftId, employee.id);
  return employee;
}
