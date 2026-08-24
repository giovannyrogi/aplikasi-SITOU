import pool from "@/lib/dbConfig";
import { withTransaction } from "@/lib/dbTransaction";
import { writeAudit } from "@/lib/audit";
import { ServiceError } from "@/lib/api/routeHelpers";
import { ensureActorEmployeeAccess } from "@/lib/auth/permissions";
import { getActorLocationScope } from "@/lib/auth/permissions";

const caseSelect = `SELECT discipline_case.id::text,discipline_case.organization_id::text,
  organization.name AS organization_name,discipline_case.case_no,
  discipline_case.employee_id::text,employee.employee_no,employee.full_name,
  discipline_case.severity,discipline_case.incident_date::text,discipline_case.description,
  discipline_case.employee_explanation,discipline_case.status,discipline_case.opened_at,
  opener_identity.display_name AS opened_by_name,
  (SELECT count(*)::int FROM disciplinary_actions action
    WHERE action.organization_id=discipline_case.organization_id
      AND action.discipline_case_id=discipline_case.id) AS action_count,
  (SELECT action.action_type FROM disciplinary_actions action
    WHERE action.organization_id=discipline_case.organization_id
      AND action.discipline_case_id=discipline_case.id
    ORDER BY action.issued_date DESC,action.id DESC LIMIT 1) AS latest_action_type
  FROM discipline_cases discipline_case
  JOIN organizations organization ON organization.id=discipline_case.organization_id
  JOIN employees employee ON employee.organization_id=discipline_case.organization_id
    AND employee.id=discipline_case.employee_id
  JOIN users opener ON opener.id=discipline_case.opened_by_user_id JOIN v_user_identity opener_identity ON opener_identity.user_id=opener.id`;

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
      `${caseSelect} ${where} ORDER BY discipline_case.incident_date DESC,discipline_case.id DESC LIMIT $7 OFFSET $8`,
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
export async function getDisciplineCase(id, organizationId, database = pool) {
  const result = await database.query(
    `${caseSelect} WHERE discipline_case.id=$1 AND discipline_case.organization_id=$2`,
    [id, organizationId],
  );
  if (!result.rows[0]) throw new ServiceError("NOT_FOUND", "Kasus disiplin tidak ditemukan.", 404);
  const actions = await database.query(
    `SELECT action.id::text,action.action_type,action.letter_no,action.issued_date::text,
      action.effective_from::text,action.effective_until::text,action.status,
      action.direct_escalation,action.escalation_reason,action.document_file_id::text,
      action.notes,issuer_identity.display_name AS issued_by_name,action.created_at
      FROM disciplinary_actions action JOIN users issuer ON issuer.id=action.issued_by_user_id JOIN v_user_identity issuer_identity ON issuer_identity.user_id=issuer.id
      WHERE action.organization_id=$1 AND action.discipline_case_id=$2
      ORDER BY action.issued_date DESC,action.id DESC`,
    [organizationId, id],
  );
  return { ...result.rows[0], actions: actions.rows };
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

/** Menerbitkan tindakan; masa SP dihitung server dan file tertulis harus valid. */
export async function createDisciplinaryAction(caseId, input, actor, requestId) {
  return withTransaction(async (client) => {
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
    if (input.documentFileId) {
      const file = await client.query(
        `SELECT id FROM stored_files WHERE id=$1 AND organization_id=$2
          AND employee_id=$3 AND category='discipline_letter' AND deleted_at IS NULL`,
        [input.documentFileId, input.organizationId, disciplineCase.rows[0].employee_id],
      );
      if (!file.rows[0])
        throw new ServiceError("FILE_INVALID", "Dokumen surat sanksi tidak valid.", 400);
    }
    const isSp = ["sp1", "sp2", "sp3"].includes(input.actionType);
    const effectiveUntil = isSp
      ? await client
          .query("SELECT ($1::date+interval '3 months')::date::text AS value", [input.issuedDate])
          .then((result) => result.rows[0].value)
      : input.effectiveUntil;
    const inserted = await client.query(
      `INSERT INTO disciplinary_actions
        (organization_id,discipline_case_id,employee_id,action_type,letter_no,issued_date,
         effective_from,effective_until,status,direct_escalation,escalation_reason,
         document_file_id,issued_by_user_id,notes)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
      [
        input.organizationId,
        caseId,
        disciplineCase.rows[0].employee_id,
        input.actionType,
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
        actionType: input.actionType,
        status: input.status,
        effectiveUntil,
      },
      requestId,
    });
    return getDisciplineCase(caseId, input.organizationId, client);
  });
}

/** Mengaktifkan, mencabut, atau menandai banding tanpa menghapus histori tindakan. */
export async function updateDisciplinaryAction(id, input, actor, requestId) {
  return withTransaction(async (client) => {
    const before = await client.query(
      `SELECT action.*,discipline_case.status AS case_status FROM disciplinary_actions action
       JOIN discipline_cases discipline_case ON discipline_case.organization_id=action.organization_id
         AND discipline_case.id=action.discipline_case_id
       WHERE action.id=$1 AND action.organization_id=$2 FOR UPDATE OF action,discipline_case`,
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
    if (input.documentFileId) {
      const file = await client.query(
        `SELECT id FROM stored_files WHERE id=$1 AND organization_id=$2
          AND employee_id=$3 AND category='discipline_letter' AND deleted_at IS NULL`,
        [input.documentFileId, input.organizationId, before.rows[0].employee_id],
      );
      if (!file.rows[0])
        throw new ServiceError("FILE_INVALID", "Dokumen surat sanksi tidak valid.", 400);
    }
    const isSp = ["sp1", "sp2", "sp3"].includes(input.actionType);
    const effectiveUntil = isSp
      ? await client
          .query("SELECT ($1::date+interval '3 months')::date::text AS value", [input.issuedDate])
          .then((result) => result.rows[0].value)
      : input.effectiveUntil;
    await client.query(
      `UPDATE disciplinary_actions SET action_type=$3,letter_no=$4,issued_date=$5,
        effective_from=$6,effective_until=$7,status=$8,direct_escalation=$9,
        escalation_reason=$10,document_file_id=$11,notes=$12
       WHERE id=$1 AND organization_id=$2`,
      [
        id,
        input.organizationId,
        input.actionType,
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
      afterData: { status: input.status, actionType: input.actionType, effectiveUntil },
      requestId,
    });
    return getDisciplineCase(before.rows[0].discipline_case_id, input.organizationId, client);
  });
}

/** Mengambil kasus beserta seluruh tindakan pegawai tanpa query per kasus. */
export async function getEmployeeDisciplineHistory(employeeId, organizationId) {
  const [cases, actions] = await Promise.all([
    pool.query(
      `SELECT discipline_case.id::text,discipline_case.case_no,discipline_case.severity,
        discipline_case.incident_date::text,discipline_case.description,
        discipline_case.employee_explanation,discipline_case.status,
        discipline_case.opened_at,discipline_case.closed_at
       FROM discipline_cases discipline_case
       WHERE discipline_case.organization_id=$1 AND discipline_case.employee_id=$2
       ORDER BY discipline_case.incident_date DESC,discipline_case.id DESC`,
      [organizationId, employeeId],
    ),
    pool.query(
      `SELECT action.id::text,action.discipline_case_id::text,action.action_type,
        action.letter_no,action.issued_date::text,action.effective_from::text,
        action.effective_until::text,action.status,action.direct_escalation,
        action.escalation_reason,action.document_file_id::text,action.notes
       FROM disciplinary_actions action
       WHERE action.organization_id=$1 AND action.employee_id=$2
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
