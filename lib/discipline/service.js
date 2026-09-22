import pool from "@/lib/dbConfig";
import { withTransaction } from "@/lib/dbTransaction";
import { writeAudit } from "@/lib/audit";
import { ServiceError } from "@/lib/api/routeHelpers";
import { ensureActorEmployeeAccess } from "@/lib/auth/permissions";
import { getActorLocationScope } from "@/lib/auth/permissions";
import { canViewDraftDisciplinaryActions } from "@/lib/discipline/visibility.mjs";
import {
  commitPreparedEmployeeFile,
  purgeStagedStoredFiles,
  restoreStagedStoredFiles,
  stageStoredFilesForDeletion,
} from "@/lib/files/storage";

/** Menyaring ringkasan tindakan draft untuk role yang hanya boleh membaca keputusan resmi. */
const buildCaseSelect = (includeDraftActions = true) => {
  const visibleAction = includeDraftActions ? "" : " AND action.status<>'draft'";
  return `SELECT discipline_case.id::text,discipline_case.organization_id::text,
  organization.name AS organization_name,discipline_case.case_no,
  discipline_case.employee_id::text,employee.employee_no,employee.full_name,
  discipline_case.severity,discipline_case.incident_date::text,discipline_case.description,
  discipline_case.employee_explanation,discipline_case.status,discipline_case.opened_at,
  opener_identity.display_name AS opened_by_name,
  (SELECT count(*)::int FROM disciplinary_actions action
    WHERE action.organization_id=discipline_case.organization_id
      AND action.discipline_case_id=discipline_case.id${visibleAction}) AS action_count,
  (SELECT action.action_name_snapshot FROM disciplinary_actions action
    WHERE action.organization_id=discipline_case.organization_id
      AND action.discipline_case_id=discipline_case.id
      ${visibleAction}
    ORDER BY action.issued_date DESC,action.id DESC LIMIT 1) AS latest_action_name
  FROM discipline_cases discipline_case
  JOIN organizations organization ON organization.id=discipline_case.organization_id
  JOIN employees employee ON employee.organization_id=discipline_case.organization_id
    AND employee.id=discipline_case.employee_id
  JOIN users opener ON opener.id=discipline_case.opened_by_user_id JOIN v_user_identity opener_identity ON opener_identity.user_id=opener.id`;
};

/** Membuat nomor kasus berurutan per organisasi dan tahun di dalam lock transaksi. */
async function createCaseNumber(client, organizationId, incidentDate) {
  const year = Number(incidentDate.slice(0, 4));
  await client.query("SELECT pg_advisory_xact_lock($1::int,$2::int)", [organizationId, year]);
  const result = await client.query(
    `SELECT count(*)::int+1 AS sequence FROM discipline_cases
      WHERE organization_id=$1 AND extract(year FROM incident_date)=$2`,
    [organizationId, year],
  );
  return `KASUS-${year}-${String(result.rows[0].sequence).padStart(5, "0")}`;
}

/** Menegakkan snapshot kebijakan tindakan di server, bukan berdasarkan payload klien. */
function ensureRequiredDisciplineLetter(input, actionType) {
  if (input.status !== "active" || !actionType.requires_document) return;
  if (!input.letterNo)
    throw new ServiceError("LETTER_NUMBER_REQUIRED", "Nomor surat tindakan wajib diisi.", 400);
  if (!input.documentFileId)
    throw new ServiceError(
      "DISCIPLINE_LETTER_REQUIRED",
      "PDF surat tindakan wajib diunggah sebelum tindakan disimpan.",
      400,
    );
}

async function getActiveActionType(client, organizationId, actionTypeId) {
  const result = await client.query(
    `SELECT id,name,system_key,duration_mode,duration_value,duration_unit,requires_document,is_active
     FROM disciplinary_action_types
     WHERE id=$1 AND organization_id=$2 FOR SHARE`,
    [actionTypeId, organizationId],
  );
  if (!result.rows[0])
    throw new ServiceError("ACTION_TYPE_INVALID", "Jenis tindakan tidak ditemukan.", 400, {
      actionTypeId: "Pilih jenis tindakan yang tersedia.",
    });
  if (!result.rows[0].is_active)
    throw new ServiceError(
      "ACTION_TYPE_INACTIVE",
      "Jenis tindakan sudah dinonaktifkan dan tidak dapat digunakan.",
      409,
      { actionTypeId: "Pilih jenis tindakan yang masih aktif." },
    );
  return result.rows[0];
}

async function calculateEffectiveUntil(client, effectiveFrom, actionType) {
  if (actionType.duration_mode === "indefinite") return null;
  const result = await client.query(
    `SELECT CASE WHEN $3='day'
      THEN ($1::date+make_interval(days=>$2::int))::date::text
      ELSE ($1::date+make_interval(months=>$2::int))::date::text END AS value`,
    [effectiveFrom, actionType.duration_value, actionType.duration_unit],
  );
  return result.rows[0].value;
}

function ensureEscalationSupported(input, actionType) {
  if (input.directEscalation && !["sp2", "sp3"].includes(actionType.system_key))
    throw new ServiceError(
      "DIRECT_ESCALATION_NOT_SUPPORTED",
      "Eskalasi langsung hanya tersedia untuk SP2 atau SP3.",
      400,
      { directEscalation: "Nonaktifkan eskalasi langsung untuk jenis tindakan ini." },
    );
}

async function closePreviousActions(
  client,
  organizationId,
  employeeId,
  actorUserId,
  requestId,
  currentActionId = null,
) {
  const expired = await client.query(
    `UPDATE disciplinary_actions action SET status='expired'
     FROM organizations organization
     WHERE organization.id=action.organization_id
       AND action.organization_id=$1 AND action.employee_id=$2
       AND action.status='active' AND action.effective_until IS NOT NULL
       AND action.effective_until < (now() AT TIME ZONE organization.timezone)::date
     RETURNING action.id`,
    [organizationId, employeeId],
  );
  const superseded = await client.query(
    `UPDATE disciplinary_actions SET status='superseded'
     WHERE organization_id=$1 AND employee_id=$2 AND status='active'
       AND ($3::bigint IS NULL OR id<>$3::bigint)
     RETURNING id`,
    [organizationId, employeeId, currentActionId],
  );
  for (const row of expired.rows)
    await writeAudit(client, {
      organizationId,
      actorUserId,
      action: "disciplinary_action.expire",
      entityType: "disciplinary_action",
      entityId: row.id,
      beforeData: { status: "active" },
      afterData: { status: "expired" },
      requestId,
    });
  for (const row of superseded.rows)
    await writeAudit(client, {
      organizationId,
      actorUserId,
      action: "disciplinary_action.supersede",
      entityType: "disciplinary_action",
      entityId: row.id,
      beforeData: { status: "active" },
      afterData: { status: "superseded" },
      requestId,
    });
}

/** Mengambil daftar kasus disiplin manual sesuai organisasi. */
export async function listDisciplineCases({
  search,
  page,
  pageSize,
  organizationId,
  employeeId,
  severity,
  caseStatus,
  actor,
}) {
  const offset = (page - 1) * pageSize;
  const includeDraftActions = canViewDraftDisciplinaryActions(actor);
  const scopedLocationIds = await getActorLocationScope(actor);
  const filterParams = [
    `%${search}%`,
    organizationId,
    employeeId,
    severity,
    caseStatus,
    scopedLocationIds,
  ];
  const where = `WHERE discipline_case.organization_id=$2
    AND ($1='' OR discipline_case.case_no ILIKE $1 OR employee.employee_no ILIKE $1
      OR employee.full_name ILIKE $1 OR discipline_case.description ILIKE $1)
    AND ($3::bigint IS NULL OR discipline_case.employee_id=$3)
    AND ($4='all' OR discipline_case.severity=$4)
    AND ($5='all' OR discipline_case.status=$5)
    AND ($6::bigint[] IS NULL OR EXISTS(
      SELECT 1 FROM employee_assignments scoped_assignment
      WHERE scoped_assignment.organization_id=discipline_case.organization_id
        AND scoped_assignment.employee_id=discipline_case.employee_id
        AND scoped_assignment.assignment_type='primary'
        AND scoped_assignment.effective_from<=current_date
        AND (scoped_assignment.effective_until IS NULL OR scoped_assignment.effective_until>=current_date)
        AND scoped_assignment.location_id=ANY($6::bigint[])))`;
  const [rows, count] = await Promise.all([
    pool.query(
      `${buildCaseSelect(includeDraftActions)} ${where} ORDER BY discipline_case.incident_date DESC,discipline_case.id DESC LIMIT $7 OFFSET $8`,
      [...filterParams, pageSize, offset],
    ),
    pool.query(
      `SELECT count(*)::int AS total FROM discipline_cases discipline_case
        JOIN employees employee ON employee.organization_id=discipline_case.organization_id
          AND employee.id=discipline_case.employee_id ${where}`,
      filterParams,
    ),
  ]);
  return { data: rows.rows, total: count.rows[0].total };
}

/** Mengambil kasus dan seluruh tindakan resminya. */
export async function getDisciplineCase(
  id,
  organizationId,
  database = pool,
  { includeDraftActions = true } = {},
) {
  const result = await database.query(
    `${buildCaseSelect(includeDraftActions)} WHERE discipline_case.id=$1 AND discipline_case.organization_id=$2`,
    [id, organizationId],
  );
  if (!result.rows[0]) throw new ServiceError("NOT_FOUND", "Kasus disiplin tidak ditemukan.", 404);
  const actions = await database.query(
    `SELECT action.id::text,action.action_type_id::text,action.action_name_snapshot,
      (type.system_key IN ('sp2','sp3')) AS allows_direct_escalation,
      CASE WHEN type.system_key IN ('sp1','sp2','sp3') THEN 'sanksi_'||type.system_key
        ELSE 'sanksi_lainnya' END AS upload_file_kind,
      action.requires_document_snapshot,
      action.duration_value_snapshot,action.duration_unit_snapshot,
      action.letter_no,action.issued_date::text,
      action.effective_from::text,action.effective_until::text,
      CASE WHEN action.status='active' AND action.effective_until IS NOT NULL
        AND action.effective_until < (now() AT TIME ZONE organization.timezone)::date
        THEN 'expired' ELSE action.status END AS status,
      action.direct_escalation,action.escalation_reason,action.document_file_id::text,
      action.notes,issuer_identity.display_name AS issued_by_name,action.created_at,
      action.revoked_at,action.revoked_by_user_id::text,
      revoker_identity.display_name AS revoked_by_name,action.revocation_reason
      FROM disciplinary_actions action
      JOIN organizations organization ON organization.id=action.organization_id
      JOIN disciplinary_action_types type ON type.organization_id=action.organization_id
        AND type.id=action.action_type_id
      JOIN users issuer ON issuer.id=action.issued_by_user_id
      JOIN v_user_identity issuer_identity ON issuer_identity.user_id=issuer.id
      LEFT JOIN v_user_identity revoker_identity ON revoker_identity.user_id=action.revoked_by_user_id
      WHERE action.organization_id=$1 AND action.discipline_case_id=$2
        ${includeDraftActions ? "" : "AND action.status<>'draft'"}
      ORDER BY action.issued_date DESC,action.id DESC`,
    [organizationId, id],
  );
  return { ...result.rows[0], actions: actions.rows };
}

/** Mengambil detail kasus dengan visibilitas tindakan yang dibatasi berdasarkan role pembaca. */
export async function getDisciplineCaseForActor(id, organizationId, actor) {
  return getDisciplineCase(id, organizationId, pool, {
    includeDraftActions: canViewDraftDisciplinaryActions(actor),
  });
}

/** Membuka kasus disiplin manual tanpa membuat sanksi otomatis. */
export async function createDisciplineCase(input, actor, requestId) {
  return withTransaction(async (client) => {
    await ensureActorEmployeeAccess(actor, input.employeeId, input.organizationId, client);
    const employee = await client.query(
      "SELECT id FROM employees WHERE id=$1 AND organization_id=$2 AND deleted_at IS NULL",
      [input.employeeId, input.organizationId],
    );
    if (!employee.rows[0])
      throw new ServiceError("EMPLOYEE_INVALID", "Pegawai tidak ditemukan.", 400);
    const caseNo = await createCaseNumber(client, input.organizationId, input.incidentDate);
    const inserted = await client.query(
      `INSERT INTO discipline_cases
        (organization_id,case_no,employee_id,severity,incident_date,description,
         employee_explanation,status,opened_by_user_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7,'open',$8) RETURNING id`,
      [
        input.organizationId,
        caseNo,
        input.employeeId,
        input.severity,
        input.incidentDate,
        input.description,
        input.employeeExplanation,
        actor.id,
      ],
    );
    await writeAudit(client, {
      organizationId: input.organizationId,
      actorUserId: actor.id,
      action: "discipline_case.create",
      entityType: "discipline_case",
      entityId: inserted.rows[0].id,
      afterData: { caseNo, employeeId: input.employeeId, severity: input.severity },
      requestId,
    });
    return getDisciplineCase(inserted.rows[0].id, input.organizationId, client);
  });
}

/** Memperbarui pemeriksaan kasus sebelum tindakan resmi diterbitkan. */
export async function updateDisciplineCase(id, input, actor, requestId) {
  return withTransaction(async (client) => {
    const before = await client.query(
      "SELECT * FROM discipline_cases WHERE id=$1 AND organization_id=$2 FOR UPDATE",
      [id, input.organizationId],
    );
    if (!before.rows[0])
      throw new ServiceError("NOT_FOUND", "Kasus disiplin tidak ditemukan.", 404);
    if (before.rows[0].status === "action_issued")
      throw new ServiceError(
        "CASE_LOCKED",
        "Kasus yang sudah memiliki tindakan resmi tidak dapat diubah.",
        409,
      );
    await client.query(
      `UPDATE discipline_cases SET severity=$3,incident_date=$4,description=$5,
        employee_explanation=$6,status=$7,closed_at=CASE WHEN $7='closed_no_action' THEN now() ELSE NULL END
        WHERE id=$1 AND organization_id=$2`,
      [
        id,
        input.organizationId,
        input.severity,
        input.incidentDate,
        input.description,
        input.employeeExplanation,
        input.status,
      ],
    );
    await writeAudit(client, {
      organizationId: input.organizationId,
      actorUserId: actor.id,
      action: "discipline_case.update",
      entityType: "discipline_case",
      entityId: id,
      beforeData: { status: before.rows[0].status, severity: before.rows[0].severity },
      afterData: { status: input.status, severity: input.severity },
      requestId,
    });
    return getDisciplineCase(id, input.organizationId, client);
  });
}

async function getDisciplineUploadContext({ actionId, caseId, organizationId, actionTypeId }) {
  const result = await pool.query(
    `SELECT employee.id::text AS employee_id,type.system_key
     FROM disciplinary_action_types type
     JOIN discipline_cases discipline_case
       ON discipline_case.organization_id=type.organization_id
       AND discipline_case.id=COALESCE($2::bigint,
         (SELECT action.discipline_case_id FROM disciplinary_actions action
          WHERE action.id=$1 AND action.organization_id=$3))
     JOIN employees employee ON employee.organization_id=discipline_case.organization_id
       AND employee.id=discipline_case.employee_id
     WHERE type.id=$4 AND type.organization_id=$3`,
    [actionId, caseId, organizationId, actionTypeId],
  );
  if (!result.rows[0])
    throw new ServiceError("ACTION_CONTEXT_INVALID", "Kasus atau jenis tindakan tidak ditemukan.", 404);
  const systemKey = String(result.rows[0].system_key || "").toLowerCase();
  return {
    employeeId: result.rows[0].employee_id,
    fileKind: ["sp1", "sp2", "sp3"].includes(systemKey) ? `sanksi_${systemKey}` : "sanksi_lainnya",
  };
}

/** Menerbitkan tindakan memakai snapshot kebijakan organisasi yang dihitung server. */
export async function createDisciplinaryAction(caseId, input, actor, requestId, documentFile = null) {
  const uploadContext = await getDisciplineUploadContext({
    caseId,
    organizationId: input.organizationId,
    actionTypeId: input.actionTypeId,
  });
  return commitPreparedEmployeeFile(
    {
      file: documentFile,
      fileKind: uploadContext.fileKind,
      employeeId: uploadContext.employeeId,
      organizationId: input.organizationId,
      actor,
      requestId,
    },
    async (client, uploadedFile) => {
      if (uploadedFile) input = { ...input, documentFileId: uploadedFile.id };
    const disciplineCase = await client.query(
      "SELECT * FROM discipline_cases WHERE id=$1 AND organization_id=$2 FOR UPDATE",
      [caseId, input.organizationId],
    );
    if (!disciplineCase.rows[0])
      throw new ServiceError("NOT_FOUND", "Kasus disiplin tidak ditemukan.", 404);
    await ensureActorEmployeeAccess(
      actor,
      disciplineCase.rows[0].employee_id,
      input.organizationId,
      client,
    );
    if (disciplineCase.rows[0].status === "closed_no_action")
      throw new ServiceError("CASE_CLOSED", "Kasus sudah ditutup tanpa tindakan.", 409);
    // Lock kasus menserialisasi pemeriksaan ini agar dua request bersamaan tidak membuat dua tindakan.
    const existingAction = await client.query(
      `SELECT id FROM disciplinary_actions
       WHERE organization_id=$1 AND discipline_case_id=$2
       LIMIT 1`,
      [input.organizationId, caseId],
    );
    if (existingAction.rows[0])
      throw new ServiceError(
        "DISCIPLINARY_ACTION_EXISTS",
        "Kasus ini sudah memiliki tindakan resmi. Catat kasus baru untuk pelanggaran berikutnya.",
        409,
      );
    const actionType = await getActiveActionType(
      client,
      input.organizationId,
      input.actionTypeId,
    );
    ensureRequiredDisciplineLetter(input, actionType);
    ensureEscalationSupported(input, actionType);
    if (input.documentFileId) {
      const file = await client.query(
        `SELECT id FROM stored_files WHERE id=$1 AND organization_id=$2
          AND employee_id=$3 AND category='discipline_letter' AND deleted_at IS NULL`,
        [input.documentFileId, input.organizationId, disciplineCase.rows[0].employee_id],
      );
      if (!file.rows[0])
        throw new ServiceError("FILE_INVALID", "Dokumen surat sanksi tidak valid.", 400);
    }
    const effectiveUntil = await calculateEffectiveUntil(client, input.effectiveFrom, actionType);
    if (input.status === "active")
      await closePreviousActions(
        client,
        input.organizationId,
        disciplineCase.rows[0].employee_id,
        actor.id,
        requestId,
      );
    const inserted = await client.query(
      `INSERT INTO disciplinary_actions
        (organization_id,discipline_case_id,employee_id,action_type_id,action_name_snapshot,
         duration_value_snapshot,duration_unit_snapshot,requires_document_snapshot,
         letter_no,issued_date,effective_from,effective_until,status,direct_escalation,
         escalation_reason,document_file_id,issued_by_user_id,notes)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
        RETURNING id`,
      [
        input.organizationId,
        caseId,
        disciplineCase.rows[0].employee_id,
        actionType.id,
        actionType.name,
        actionType.duration_value,
        actionType.duration_unit,
        actionType.requires_document,
        input.letterNo,
        input.issuedDate,
        input.effectiveFrom,
        effectiveUntil,
        input.status,
        input.directEscalation,
        input.escalationReason,
        input.documentFileId,
        actor.id,
        input.notes,
      ],
    );
    const caseStatus = input.status === "active" ? "action_issued" : "investigating";
    await client.query(
      `UPDATE discipline_cases SET status=$2::varchar,
        closed_at=CASE WHEN $2::varchar='action_issued' THEN now() ELSE NULL END
       WHERE id=$1 AND organization_id=$3`,
      [caseId, caseStatus, input.organizationId],
    );
    await writeAudit(client, {
      organizationId: input.organizationId,
      actorUserId: actor.id,
      action: "disciplinary_action.create",
      entityType: "disciplinary_action",
      entityId: inserted.rows[0].id,
      afterData: {
        caseId: String(caseId),
        actionTypeId: String(actionType.id),
        actionName: actionType.name,
        status: input.status,
        effectiveUntil,
      },
      requestId,
    });
    return getDisciplineCase(caseId, input.organizationId, client);
    },
  );
}

/** Mengaktifkan, mencabut, atau menandai banding tanpa menghapus histori tindakan. */
export async function updateDisciplinaryAction(id, input, actor, requestId, documentFile = null) {
  const uploadContext = await getDisciplineUploadContext({
    actionId: id,
    organizationId: input.organizationId,
    actionTypeId: input.actionTypeId,
  });
  let stagedOldFile = null;
  try {
    const result = await commitPreparedEmployeeFile(
      {
        file: documentFile,
        fileKind: uploadContext.fileKind,
        employeeId: uploadContext.employeeId,
        organizationId: input.organizationId,
        actor,
        requestId,
      },
      async (client, uploadedFile) => {
        if (uploadedFile) input = { ...input, documentFileId: uploadedFile.id };
    const before = await client.query(
      `SELECT action.*,discipline_case.status AS case_status FROM disciplinary_actions action
       JOIN discipline_cases discipline_case ON discipline_case.organization_id=action.organization_id
         AND discipline_case.id=action.discipline_case_id
       WHERE action.id=$1 AND action.organization_id=$2 FOR UPDATE OF action,discipline_case`,
      [id, input.organizationId],
    );
    if (!before.rows[0])
      throw new ServiceError("NOT_FOUND", "Tindakan disiplin tidak ditemukan.", 404);
    if (before.rows[0].status !== "draft")
      throw new ServiceError(
        "ACTION_NOT_EDITABLE",
        "Hanya tindakan berstatus draft yang dapat diedit.",
        409,
      );
    await ensureActorEmployeeAccess(
      actor,
      before.rows[0].employee_id,
      input.organizationId,
      client,
    );
    if (
      String(before.rows[0].document_file_id || "") !== String(input.documentFileId || "") &&
      before.rows[0].document_file_id
    ) {
      const oldFile = await client.query(
        `SELECT id::text,object_key FROM stored_files
         WHERE id=$1 AND organization_id=$2 AND lifecycle_status='active' FOR UPDATE`,
        [before.rows[0].document_file_id, input.organizationId],
      );
      stagedOldFile = await stageStoredFilesForDeletion(client, oldFile.rows, {
        organizationId: input.organizationId,
        actorId: actor.id,
        reasonCode: uploadedFile ? "replaced" : "removed_by_user",
      });
    }
    const actionType = await getActiveActionType(
      client,
      input.organizationId,
      input.actionTypeId,
    );
    ensureRequiredDisciplineLetter(input, actionType);
    ensureEscalationSupported(input, actionType);
    if (input.documentFileId) {
      const file = await client.query(
        `SELECT id FROM stored_files WHERE id=$1 AND organization_id=$2
          AND employee_id=$3 AND category='discipline_letter' AND deleted_at IS NULL`,
        [input.documentFileId, input.organizationId, before.rows[0].employee_id],
      );
      if (!file.rows[0])
        throw new ServiceError("FILE_INVALID", "Dokumen surat sanksi tidak valid.", 400);
    }
    const effectiveUntil = await calculateEffectiveUntil(client, input.effectiveFrom, actionType);
    if (input.status === "active")
      await closePreviousActions(
        client,
        input.organizationId,
        before.rows[0].employee_id,
        actor.id,
        requestId,
        id,
      );
    await client.query(
      `UPDATE disciplinary_actions SET action_type_id=$3,action_name_snapshot=$4,
        duration_value_snapshot=$5,duration_unit_snapshot=$6,requires_document_snapshot=$7,
        letter_no=$8,issued_date=$9,effective_from=$10,effective_until=$11,status=$12,
        direct_escalation=$13,escalation_reason=$14,document_file_id=$15,notes=$16
       WHERE id=$1 AND organization_id=$2`,
      [
        id,
        input.organizationId,
        actionType.id,
        actionType.name,
        actionType.duration_value,
        actionType.duration_unit,
        actionType.requires_document,
        input.letterNo,
        input.issuedDate,
        input.effectiveFrom,
        effectiveUntil,
        input.status,
        input.directEscalation,
        input.escalationReason,
        input.documentFileId,
        input.notes,
      ],
    );
    const caseStatus = input.status === "active" ? "action_issued" : "investigating";
    await client.query(
      `UPDATE discipline_cases SET status=$2::varchar,
        closed_at=CASE WHEN $2::varchar='action_issued' THEN now() ELSE NULL END
       WHERE id=$1 AND organization_id=$3`,
      [before.rows[0].discipline_case_id, caseStatus, input.organizationId],
    );
    await writeAudit(client, {
      organizationId: input.organizationId,
      actorUserId: actor.id,
      action: "disciplinary_action.update",
      entityType: "disciplinary_action",
      entityId: id,
      beforeData: { status: before.rows[0].status },
      afterData: {
        status: input.status,
        actionTypeId: String(actionType.id),
        actionName: actionType.name,
        effectiveUntil,
      },
      requestId,
    });
    return getDisciplineCase(before.rows[0].discipline_case_id, input.organizationId, client);
      },
    );
    await purgeStagedStoredFiles(stagedOldFile);
    return result;
  } catch (error) {
    await restoreStagedStoredFiles(stagedOldFile).catch(() => {});
    throw error;
  }
}

/** Mencabut tindakan aktif secara logis sambil mempertahankan keputusan dan dokumen historis. */
export async function revokeDisciplinaryAction(id, input, actor, requestId) {
  return withTransaction(async (client) => {
    const before = await client.query(
      `SELECT action.*,
        CASE WHEN action.status='active' AND action.effective_until IS NOT NULL
          AND action.effective_until < (now() AT TIME ZONE organization.timezone)::date
          THEN 'expired' ELSE action.status END AS effective_status
       FROM disciplinary_actions action
       JOIN organizations organization ON organization.id=action.organization_id
       WHERE action.id=$1 AND action.organization_id=$2 FOR UPDATE OF action`,
      [id, input.organizationId],
    );
    if (!before.rows[0])
      throw new ServiceError("NOT_FOUND", "Tindakan disiplin tidak ditemukan.", 404);
    await ensureActorEmployeeAccess(
      actor,
      before.rows[0].employee_id,
      input.organizationId,
      client,
    );
    if (before.rows[0].effective_status !== "active")
      throw new ServiceError("ACTION_NOT_ACTIVE", "Hanya tindakan aktif yang dapat dicabut.", 409);

    await client.query(
      `UPDATE disciplinary_actions
       SET status='revoked',revoked_at=now(),revoked_by_user_id=$3,revocation_reason=$4
       WHERE id=$1 AND organization_id=$2`,
      [id, input.organizationId, actor.id, input.reason],
    );
    await writeAudit(client, {
      organizationId: input.organizationId,
      actorUserId: actor.id,
      action: "disciplinary_action.revoke",
      entityType: "disciplinary_action",
      entityId: id,
      beforeData: { status: before.rows[0].status },
      afterData: { status: "revoked" },
      requestId,
    });
    return getDisciplineCase(before.rows[0].discipline_case_id, input.organizationId, client);
  });
}

/** Mengambil kasus beserta seluruh tindakan pegawai tanpa query per kasus. */
export async function getEmployeeDisciplineHistory(
  employeeId,
  organizationId,
  actor,
  { officialOnly = false } = {},
) {
  const includeDraftActions = !officialOnly && canViewDraftDisciplinaryActions(actor);
  const officialCaseFilter = officialOnly
    ? `AND EXISTS(
        SELECT 1 FROM disciplinary_actions official_action
        WHERE official_action.organization_id=discipline_case.organization_id
          AND official_action.discipline_case_id=discipline_case.id
          AND official_action.status<>'draft')`
    : "";
  const [cases, actions] = await Promise.all([
    pool.query(
      `SELECT discipline_case.id::text,discipline_case.case_no,discipline_case.severity,
        discipline_case.incident_date::text,discipline_case.description,
        discipline_case.employee_explanation,discipline_case.status,
        discipline_case.opened_by_user_id::text,opener_identity.display_name AS opened_by_name,
        discipline_case.opened_at,discipline_case.closed_at
       FROM discipline_cases discipline_case
       JOIN v_user_identity opener_identity
         ON opener_identity.user_id=discipline_case.opened_by_user_id
       WHERE discipline_case.organization_id=$1 AND discipline_case.employee_id=$2
         ${officialCaseFilter}
       ORDER BY discipline_case.incident_date DESC,discipline_case.id DESC`,
      [organizationId, employeeId],
    ),
    pool.query(
      `SELECT action.id::text,action.discipline_case_id::text,action.action_type_id::text,
        action.action_name_snapshot,
        action.requires_document_snapshot,action.duration_value_snapshot,
        action.duration_unit_snapshot,action.letter_no,action.issued_date::text,
        action.effective_from::text,action.effective_until::text,
        CASE WHEN action.status='active' AND action.effective_until IS NOT NULL
          AND action.effective_until < (now() AT TIME ZONE organization.timezone)::date
          THEN 'expired' ELSE action.status END AS status,
        action.direct_escalation,
        action.escalation_reason,action.document_file_id::text,action.notes,
        action.issued_by_user_id::text,issuer_identity.display_name AS issued_by_name,
        action.revoked_at,action.revoked_by_user_id::text,
        revoker_identity.display_name AS revoked_by_name,action.revocation_reason,
        action.created_at,document.original_name AS document_original_name,
        document.mime_type AS document_mime_type,document.size_bytes AS document_size_bytes,
        document.created_at AS document_uploaded_at
       FROM disciplinary_actions action
       JOIN organizations organization ON organization.id=action.organization_id
       JOIN disciplinary_action_types type ON type.organization_id=action.organization_id
         AND type.id=action.action_type_id
       JOIN v_user_identity issuer_identity ON issuer_identity.user_id=action.issued_by_user_id
       LEFT JOIN v_user_identity revoker_identity
         ON revoker_identity.user_id=action.revoked_by_user_id
       LEFT JOIN stored_files document
         ON document.organization_id=action.organization_id
        AND document.id=action.document_file_id AND document.deleted_at IS NULL
       WHERE action.organization_id=$1 AND action.employee_id=$2
        ${includeDraftActions ? "" : "AND action.status<>'draft'"}
       ORDER BY action.issued_date DESC,action.id DESC`,
      [organizationId, employeeId],
    ),
  ]);
  const actionsByCase = new Map();
  for (const action of actions.rows) {
    const values = actionsByCase.get(action.discipline_case_id) || [];
    values.push(action);
    actionsByCase.set(action.discipline_case_id, values);
  }
  return cases.rows.map((disciplineCase) => ({
    ...disciplineCase,
    actions: actionsByCase.get(disciplineCase.id) || [],
  }));
}
