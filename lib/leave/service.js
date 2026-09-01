import pool from "@/lib/dbConfig";
import { withTransaction } from "@/lib/dbTransaction";
import { writeAudit } from "@/lib/audit";
import { ServiceError } from "@/lib/api/routeHelpers";
import { ensureActorEmployeeAccess, getActorLocationScope } from "@/lib/auth/permissions";

const TYPE_SELECT = `SELECT type.id::text,type.organization_id::text,organization.name AS organization_name,
  type.code,type.name,type.category,type.unit,type.requires_attachment,type.required_attachment_category,
  type.uses_balance,type.annual_allowance,type.is_active,type.created_at,type.updated_at,
  (SELECT count(*)::int FROM leave_requests request WHERE request.organization_id=type.organization_id AND request.leave_type_id=type.id) AS request_count
  FROM leave_types type JOIN organizations organization ON organization.id=type.organization_id`;

const mapDuplicate = (error) => {
  if (error?.code === "23505")
    throw new ServiceError(
      "DUPLICATE_LEAVE_TYPE",
      "Nama cuti atau izin tersebut sudah tersedia pada organisasi ini.",
      409,
      { name: "Gunakan nama cuti atau izin yang berbeda." },
    );
  throw error;
};

const leaveTypeCodeBase = (name) =>
  String(name)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24) || "JENIS";

async function createLeaveTypeCode(client, organizationId, name) {
  await client.query("SELECT pg_advisory_xact_lock($1::int,22001)", [organizationId]);
  const base = leaveTypeCodeBase(name);
  const result = await client.query(
    "SELECT code FROM leave_types WHERE organization_id=$1 AND (code=$2 OR code LIKE $2||'_%')",
    [organizationId, base],
  );
  const used = new Set(result.rows.map((row) => row.code));
  if (!used.has(base)) return base;
  for (let sequence = 2; sequence < 10000; sequence += 1) {
    const suffix = `_${sequence}`;
    const candidate = `${base.slice(0, 30 - suffix.length)}${suffix}`;
    if (!used.has(candidate)) return candidate;
  }
  throw new ServiceError(
    "LEAVE_TYPE_CODE_EXHAUSTED",
    "Pilihan cuti atau izin tidak dapat dibuat. Silakan gunakan nama lain.",
    409,
    { name: "Gunakan nama cuti atau izin yang berbeda." },
  );
}

export async function listLeaveTypes({ search, status, page, pageSize, organizationId }) {
  const offset = (page - 1) * pageSize;
  const params = [`%${search}%`, status, organizationId || null, pageSize, offset];
  const where = `WHERE ($1='' OR type.code ILIKE $1 OR type.name ILIKE $1)
    AND ($2='all' OR type.is_active=($2='active')) AND ($3::bigint IS NULL OR type.organization_id=$3)`;
  const [rows, count] = await Promise.all([
    pool.query(`${TYPE_SELECT} ${where} ORDER BY type.name,type.id LIMIT $4 OFFSET $5`, params),
    pool.query(`SELECT count(*)::int AS total FROM leave_types type ${where}`, params.slice(0, 3)),
  ]);
  return { data: rows.rows, total: count.rows[0].total };
}

export async function getLeaveTypeOptions(organizationId, activeOnly = true) {
  const result = await pool.query(
    `SELECT id::text,code,name,category,unit,requires_attachment,
    required_attachment_category,uses_balance,annual_allowance FROM leave_types
    WHERE organization_id=$1 AND ($2=false OR is_active=true) ORDER BY name`,
    [organizationId, activeOnly],
  );
  return result.rows;
}

export async function createLeaveType(input, actor, requestId) {
  try {
    return await withTransaction(async (client) => {
      const code = await createLeaveTypeCode(client, input.organizationId, input.name);
      const inserted = await client.query(
        `INSERT INTO leave_types
        (organization_id,code,name,category,unit,requires_attachment,required_attachment_category,uses_balance,annual_allowance,is_active)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
        [
          input.organizationId,
          code,
          input.name,
          input.category,
          input.unit,
          input.requiresAttachment,
          input.requiresAttachment ? input.requiredAttachmentCategory : null,
          input.usesBalance,
          input.usesBalance ? input.annualAllowance : null,
          input.isActive,
        ],
      );
      await writeAudit(client, {
        organizationId: input.organizationId,
        actorUserId: actor.id,
        action: "leave_type.create",
        entityType: "leave_type",
        entityId: inserted.rows[0].id,
        afterData: input,
        requestId,
      });
      const row = await client.query(
        `${TYPE_SELECT} WHERE type.id=$1 AND type.organization_id=$2`,
        [inserted.rows[0].id, input.organizationId],
      );
      return row.rows[0];
    });
  } catch (error) {
    mapDuplicate(error);
  }
}

export async function updateLeaveType(id, input, actor, requestId) {
  try {
    return await withTransaction(async (client) => {
      const before = await client.query(
        "SELECT * FROM leave_types WHERE id=$1 AND organization_id=$2 FOR UPDATE",
        [id, input.organizationId],
      );
      if (!before.rows[0])
        throw new ServiceError(
          "LEAVE_TYPE_NOT_FOUND",
          "Aturan cuti atau izin tidak ditemukan.",
          404,
        );
      const updated = await client.query(
        `UPDATE leave_types SET code=$3,name=$4,category=$5,unit=$6,
        requires_attachment=$7,required_attachment_category=$8,uses_balance=$9,annual_allowance=$10,is_active=$11
        WHERE id=$1 AND organization_id=$2 AND date_trunc('milliseconds',updated_at)=date_trunc('milliseconds',$12::timestamptz) RETURNING id`,
        [
          id,
          input.organizationId,
          before.rows[0].code,
          input.name,
          input.category,
          input.unit,
          input.requiresAttachment,
          input.requiresAttachment ? input.requiredAttachmentCategory : null,
          input.usesBalance,
          input.usesBalance ? input.annualAllowance : null,
          input.isActive,
          input.version,
        ],
      );
      if (!updated.rowCount)
        throw new ServiceError(
          "VERSION_CONFLICT",
          "Data telah berubah. Muat ulang sebelum menyimpan.",
          409,
        );
      await writeAudit(client, {
        organizationId: input.organizationId,
        actorUserId: actor.id,
        action: "leave_type.update",
        entityType: "leave_type",
        entityId: id,
        beforeData: before.rows[0],
        afterData: input,
        requestId,
      });
      const row = await client.query(
        `${TYPE_SELECT} WHERE type.id=$1 AND type.organization_id=$2`,
        [id, input.organizationId],
      );
      return row.rows[0];
    });
  } catch (error) {
    mapDuplicate(error);
  }
}

const SORTS = {
  start_desc: "request.start_at DESC,request.id DESC",
  start_asc: "request.start_at,request.id",
  end_desc: "request.end_at DESC,request.id DESC",
  employee_asc: "employee.full_name,request.start_at DESC",
  status_asc: "request.status,request.start_at DESC",
  type_asc: "type.name,request.start_at DESC",
  created_desc: "request.created_at DESC,request.id DESC",
};
const REQUEST_SELECT = `SELECT request.id::text,request.organization_id::text,request.request_no,
  request.employee_id::text,employee.employee_no,employee.full_name,employee.employment_status,
  request.leave_type_id::text,type.code AS leave_type_code,type.name AS leave_type_name,type.category,type.unit,
  type.uses_balance,type.requires_attachment,request.start_at::date::text AS start_date,
  request.end_at::date::text AS end_date,request.requested_units,request.reason,request.submission_source,
  request.status,request.submitted_at,request.created_at,request.updated_at,request.cancelled_at,
  request.cancellation_reason,creator_identity.display_name AS created_by_name,
  decision.notes AS decision_notes,decision.decided_at,decider_identity.display_name AS decided_by_name,
  canceller_identity.display_name AS cancelled_by_name,
  assignment.location_id::text,location.name AS location_name,assignment.organization_unit_id::text,
  unit.name AS organization_unit_name,assignment.position_id::text,position.name AS position_name,
  (SELECT count(*)::int FROM leave_request_attachments attachment WHERE attachment.organization_id=request.organization_id AND attachment.leave_request_id=request.id) AS attachment_count,
  COALESCE((SELECT jsonb_agg(jsonb_build_object('id',file.id::text,'name',file.original_name,'mimeType',file.mime_type,'category',attachment.attachment_category) ORDER BY attachment.uploaded_at)
    FROM leave_request_attachments attachment JOIN stored_files file ON file.organization_id=attachment.organization_id AND file.id=attachment.file_id AND file.deleted_at IS NULL
    WHERE attachment.organization_id=request.organization_id AND attachment.leave_request_id=request.id),'[]'::jsonb) AS attachments
  FROM leave_requests request
  JOIN employees employee ON employee.organization_id=request.organization_id AND employee.id=request.employee_id
  JOIN leave_types type ON type.organization_id=request.organization_id AND type.id=request.leave_type_id
  LEFT JOIN leave_decisions decision ON decision.organization_id=request.organization_id AND decision.leave_request_id=request.id
  LEFT JOIN v_user_identity creator_identity ON creator_identity.user_id=request.created_by_user_id
  LEFT JOIN v_user_identity decider_identity ON decider_identity.user_id=decision.decided_by_user_id
  LEFT JOIN v_user_identity canceller_identity ON canceller_identity.user_id=request.cancelled_by_user_id
  LEFT JOIN LATERAL (SELECT a.* FROM employee_assignments a WHERE a.organization_id=request.organization_id AND a.employee_id=request.employee_id AND a.assignment_type='primary' AND a.effective_from<=request.start_at::date AND (a.effective_until IS NULL OR a.effective_until>=request.start_at::date) ORDER BY a.effective_from DESC,a.id DESC LIMIT 1) assignment ON true
  LEFT JOIN locations location ON location.organization_id=assignment.organization_id AND location.id=assignment.location_id
  LEFT JOIN organization_units unit ON unit.organization_id=assignment.organization_id AND unit.id=assignment.organization_unit_id
  LEFT JOIN positions position ON position.organization_id=assignment.organization_id AND position.id=assignment.position_id`;

export async function listLeaveRequests({
  search,
  page,
  pageSize,
  organizationId,
  employeeId,
  leaveTypeId,
  locationId,
  organizationUnitId,
  positionId,
  requestStatus,
  category,
  periodState,
  source,
  balanceMode,
  attachment,
  employeeStatus,
  startDate,
  endDate,
  sort,
  actor,
}) {
  const offset = (page - 1) * pageSize;
  const scoped = await getActorLocationScope(actor);
  const params = [
    `%${search}%`,
    organizationId,
    employeeId,
    leaveTypeId,
    locationId,
    organizationUnitId,
    positionId,
    requestStatus,
    category,
    periodState,
    source,
    balanceMode,
    attachment,
    employeeStatus,
    startDate,
    endDate,
    scoped,
  ];
  const where = `WHERE request.organization_id=$2
    AND ($1='' OR request.request_no ILIKE $1 OR employee.employee_no ILIKE $1 OR employee.full_name ILIKE $1 OR request.reason ILIKE $1)
    AND ($3::bigint IS NULL OR request.employee_id=$3) AND ($4::bigint IS NULL OR request.leave_type_id=$4)
    AND ($5::bigint IS NULL OR assignment.location_id=$5) AND ($6::bigint IS NULL OR assignment.organization_unit_id=$6)
    AND ($7::bigint IS NULL OR assignment.position_id=$7) AND ($8='all' OR request.status=$8)
    AND ($9='all' OR type.category=$9)
    AND ($10='all' OR ($10='ongoing' AND current_date BETWEEN request.start_at::date AND request.end_at::date AND request.status='approved') OR ($10='upcoming' AND request.start_at::date>current_date AND request.status='approved') OR ($10='completed' AND request.end_at::date<current_date))
    AND ($11='all' OR request.submission_source=$11) AND ($12='all' OR type.uses_balance=($12='used'))
    AND ($13='all' OR ($13='with' AND EXISTS(SELECT 1 FROM leave_request_attachments la WHERE la.organization_id=request.organization_id AND la.leave_request_id=request.id)) OR ($13='without' AND NOT EXISTS(SELECT 1 FROM leave_request_attachments la WHERE la.organization_id=request.organization_id AND la.leave_request_id=request.id)) OR ($13='incomplete' AND type.requires_attachment AND NOT EXISTS(SELECT 1 FROM leave_request_attachments la WHERE la.organization_id=request.organization_id AND la.leave_request_id=request.id)))
    AND ($14='all' OR employee.employment_status=$14)
    AND ($15::date IS NULL OR request.end_at::date >= $15::date) AND ($16::date IS NULL OR request.start_at::date <= $16::date)
    AND ($17::bigint[] IS NULL OR assignment.location_id=ANY($17::bigint[]))`;
  const countFrom = `FROM leave_requests request JOIN employees employee ON employee.organization_id=request.organization_id AND employee.id=request.employee_id JOIN leave_types type ON type.organization_id=request.organization_id AND type.id=request.leave_type_id LEFT JOIN LATERAL (SELECT a.* FROM employee_assignments a WHERE a.organization_id=request.organization_id AND a.employee_id=request.employee_id AND a.assignment_type='primary' AND a.effective_from<=request.start_at::date AND (a.effective_until IS NULL OR a.effective_until>=request.start_at::date) ORDER BY a.effective_from DESC,a.id DESC LIMIT 1) assignment ON true`;
  const [rows, count] = await Promise.all([
    pool.query(
      `${REQUEST_SELECT} ${where} ORDER BY ${SORTS[sort] || SORTS.start_desc} LIMIT $18 OFFSET $19`,
      [...params, pageSize, offset],
    ),
    pool.query(`SELECT count(*)::int AS total ${countFrom} ${where}`, params),
  ]);
  return { data: rows.rows, total: count.rows[0].total };
}

export async function getLeaveRequest(id, organizationId, actor, database = pool) {
  const result = await database.query(
    `${REQUEST_SELECT} WHERE request.id=$1 AND request.organization_id=$2`,
    [id, organizationId],
  );
  if (!result.rows[0])
    throw new ServiceError(
      "LEAVE_REQUEST_NOT_FOUND",
      "Pencatatan cuti atau izin tidak ditemukan.",
      404,
    );
  await ensureActorEmployeeAccess(actor, result.rows[0].employee_id, organizationId, database);
  return result.rows[0];
}

async function requestNumber(client, organizationId, startDate) {
  const year = Number(startDate.slice(0, 4));
  await client.query("SELECT pg_advisory_xact_lock($1::int,$2::int)", [organizationId, year]);
  const result = await client.query(
    "SELECT count(*)::int+1 AS sequence FROM leave_requests WHERE organization_id=$1 AND extract(year FROM start_at)=$2",
    [organizationId, year],
  );
  return `CI-${year}-${String(result.rows[0].sequence).padStart(5, "0")}`;
}

async function ensureEntitlement(client, { organizationId, employeeId, leaveType, year, actor }) {
  const start = `${year}-01-01`,
    end = `${year}-12-31`;
  let result = await client.query(
    "SELECT * FROM leave_entitlements WHERE organization_id=$1 AND employee_id=$2 AND leave_type_id=$3 AND period_start=$4 FOR UPDATE",
    [organizationId, employeeId, leaveType.id, start],
  );
  if (!result.rows[0]) {
    const inserted = await client.query(
      `INSERT INTO leave_entitlements(organization_id,employee_id,leave_type_id,period_start,period_end,created_by_user_id) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
      [organizationId, employeeId, leaveType.id, start, end, actor.id],
    );
    if (Number(leaveType.annual_allowance) > 0)
      await client.query(
        `INSERT INTO leave_balance_transactions(organization_id,entitlement_id,transaction_type,units,reason,created_by_user_id) VALUES($1,$2,'grant',$3,'Jatah tahunan otomatis sesuai aturan cuti',$4)`,
        [organizationId, inserted.rows[0].id, leaveType.annual_allowance, actor.id],
      );
    result = inserted;
  }
  return result.rows[0];
}

export async function createLeaveRequest(input, actor, requestId) {
  return withTransaction(async (client) => {
    await ensureActorEmployeeAccess(actor, input.employeeId, input.organizationId, client);
    const employee = (
      await client.query(
        "SELECT * FROM employees WHERE id=$1 AND organization_id=$2 AND deleted_at IS NULL FOR UPDATE",
        [input.employeeId, input.organizationId],
      )
    ).rows[0];
    if (!employee) throw new ServiceError("EMPLOYEE_NOT_FOUND", "Pegawai tidak ditemukan.", 404);
    if (!["active", "probation"].includes(employee.employment_status))
      throw new ServiceError(
        "EMPLOYEE_STATUS_INELIGIBLE",
        "Hanya pegawai aktif atau masa percobaan yang dapat dicatatkan cuti atau izin.",
        409,
      );
    if (employee.joined_date && input.startDate < String(employee.joined_date).slice(0, 10))
      throw new ServiceError(
        "LEAVE_BEFORE_JOINED",
        "Tanggal mulai tidak boleh sebelum tanggal bergabung.",
        400,
        { startDate: "Pilih tanggal setelah pegawai bergabung." },
      );
    if (input.endDate < input.startDate)
      throw new ServiceError(
        "INVALID_LEAVE_PERIOD",
        "Tanggal akhir tidak boleh sebelum tanggal mulai.",
        400,
        { endDate: "Periksa tanggal akhir." },
      );
    const type = (
      await client.query(
        "SELECT * FROM leave_types WHERE id=$1 AND organization_id=$2 AND is_active=true FOR SHARE",
        [input.leaveTypeId, input.organizationId],
      )
    ).rows[0];
    if (!type)
      throw new ServiceError("LEAVE_TYPE_NOT_FOUND", "Pilihan cuti atau izin tidak tersedia.", 404);
    if (type.uses_balance && input.startDate.slice(0, 4) !== input.endDate.slice(0, 4))
      throw new ServiceError(
        "CROSS_YEAR_LEAVE_NOT_ALLOWED",
        "Cuti bersaldo yang melewati pergantian tahun harus dibuat sebagai dua pencatatan.",
        409,
        { endDate: "Pisahkan pencatatan untuk setiap tahun." },
      );
    const overlap = await client.query(
      `SELECT request_no FROM leave_requests WHERE organization_id=$1 AND employee_id=$2 AND status IN ('submitted','approved') AND daterange(start_at::date,end_at::date,'[]') && daterange($3::date,$4::date,'[]') LIMIT 1`,
      [input.organizationId, input.employeeId, input.startDate, input.endDate],
    );
    if (overlap.rows[0])
      throw new ServiceError(
        "LEAVE_PERIOD_OVERLAP",
        `Periode bertumpuk dengan ${overlap.rows[0].request_no}.`,
        409,
        { startDate: "Pilih periode yang tidak bertumpuk." },
      );
    if (type.requires_attachment && !input.attachmentFileIds.length)
      throw new ServiceError(
        "LEAVE_ATTACHMENT_REQUIRED",
        "Lampiran wajib dilengkapi untuk jenis ini.",
        400,
        { attachmentFileIds: "Unggah lampiran yang diwajibkan." },
      );
    if (input.attachmentFileIds.length) {
      const files = await client.query(
        "SELECT id FROM stored_files WHERE organization_id=$1 AND employee_id=$2 AND id=ANY($3::bigint[]) AND deleted_at IS NULL",
        [input.organizationId, input.employeeId, input.attachmentFileIds],
      );
      if (files.rowCount !== input.attachmentFileIds.length)
        throw new ServiceError(
          "LEAVE_ATTACHMENT_INVALID",
          "Salah satu lampiran tidak sesuai dengan pegawai atau organisasi.",
          400,
        );
    }
    let entitlement = null;
    if (type.uses_balance) {
      entitlement = await ensureEntitlement(client, {
        organizationId: input.organizationId,
        employeeId: input.employeeId,
        leaveType: type,
        year: Number(input.startDate.slice(0, 4)),
        actor,
      });
      const balance = await client.query(
        "SELECT COALESCE(sum(units),0)::numeric AS balance FROM leave_balance_transactions WHERE organization_id=$1 AND entitlement_id=$2",
        [input.organizationId, entitlement.id],
      );
      if (Number(balance.rows[0].balance) < Number(input.requestedUnits))
        throw new ServiceError(
          "LEAVE_BALANCE_INSUFFICIENT",
          `Saldo tidak mencukupi. Tersedia ${balance.rows[0].balance} ${type.unit === "day" ? "hari" : "jam"}.`,
          409,
          { requestedUnits: "Kurangi durasi atau sesuaikan saldo terlebih dahulu." },
        );
    }
    const requestNo = await requestNumber(client, input.organizationId, input.startDate);
    const inserted = await client.query(
      `INSERT INTO leave_requests(organization_id,request_no,employee_id,leave_type_id,start_at,end_at,requested_units,reason,submission_source,status,submitted_at,created_by_user_id) VALUES($1,$2,$3,$4,$5::date,($6::date+interval '1 day'-interval '1 microsecond'),$7,$8,'hrd_entry','approved',now(),$9) RETURNING id`,
      [
        input.organizationId,
        requestNo,
        input.employeeId,
        input.leaveTypeId,
        input.startDate,
        input.endDate,
        input.requestedUnits,
        input.reason,
        actor.id,
      ],
    );
    const id = inserted.rows[0].id;
    await client.query(
      "INSERT INTO leave_decisions(organization_id,leave_request_id,decision,decided_by_user_id,decision_role,notes) VALUES($1,$2,'approved',$3,$4,$5)",
      [
        input.organizationId,
        id,
        actor.id,
        actor.role_code === "superadmin" ? "superadmin" : "hrd",
        input.decisionNotes,
      ],
    );
    for (const fileId of input.attachmentFileIds)
      await client.query(
        "INSERT INTO leave_request_attachments(organization_id,leave_request_id,file_id,attachment_category) VALUES($1,$2,$3,$4)",
        [input.organizationId, id, fileId, type.required_attachment_category || "leave_attachment"],
      );
    if (entitlement)
      await client.query(
        "INSERT INTO leave_balance_transactions(organization_id,entitlement_id,leave_request_id,transaction_type,units,reason,created_by_user_id) VALUES($1,$2,$3,'usage',$4,$5,$6)",
        [
          input.organizationId,
          entitlement.id,
          id,
          -Number(input.requestedUnits),
          `Pemakaian untuk ${requestNo}`,
          actor.id,
        ],
      );
    await writeAudit(client, {
      organizationId: input.organizationId,
      actorUserId: actor.id,
      action: "leave_request.approve",
      entityType: "leave_request",
      entityId: id,
      afterData: {
        requestNo,
        employeeId: input.employeeId,
        leaveTypeId: input.leaveTypeId,
        startDate: input.startDate,
        endDate: input.endDate,
        requestedUnits: input.requestedUnits,
      },
      requestId,
    });
    await client.query(
      "INSERT INTO integration_outbox(organization_id,event_type,aggregate_type,aggregate_id,payload) VALUES($1,'leave_request.approved','leave_request',$2,$3::jsonb)",
      [
        input.organizationId,
        String(id),
        JSON.stringify({
          requestId: String(id),
          employeeId: String(input.employeeId),
          startDate: input.startDate,
          endDate: input.endDate,
        }),
      ],
    );
    return { id: String(id), request_no: requestNo };
  });
}

export async function cancelLeaveRequest(id, input, actor, requestId) {
  return withTransaction(async (client) => {
    const before = (
      await client.query(
        "SELECT * FROM leave_requests WHERE id=$1 AND organization_id=$2 FOR UPDATE",
        [id, input.organizationId],
      )
    ).rows[0];
    if (!before)
      throw new ServiceError(
        "LEAVE_REQUEST_NOT_FOUND",
        "Pencatatan cuti atau izin tidak ditemukan.",
        404,
      );
    await ensureActorEmployeeAccess(actor, before.employee_id, input.organizationId, client);
    if (before.status === "cancelled")
      throw new ServiceError("LEAVE_ALREADY_CANCELLED", "Pencatatan ini sudah dibatalkan.", 409);
    if (before.status !== "approved")
      throw new ServiceError(
        "LEAVE_NOT_CANCELLABLE",
        "Hanya pencatatan yang sudah disetujui yang dapat dibatalkan.",
        409,
      );
    const updated = await client.query(
      `UPDATE leave_requests SET status='cancelled',cancelled_at=now(),cancelled_by_user_id=$3,cancellation_reason=$4 WHERE id=$1 AND organization_id=$2 AND date_trunc('milliseconds',updated_at)=date_trunc('milliseconds',$5::timestamptz) RETURNING id`,
      [id, input.organizationId, actor.id, input.reason, input.version],
    );
    if (!updated.rowCount)
      throw new ServiceError(
        "VERSION_CONFLICT",
        "Data telah berubah. Muat ulang sebelum membatalkan.",
        409,
      );
    const usage = (
      await client.query(
        "SELECT * FROM leave_balance_transactions WHERE organization_id=$1 AND leave_request_id=$2 AND transaction_type='usage' FOR UPDATE",
        [input.organizationId, id],
      )
    ).rows[0];
    if (usage)
      await client.query(
        "INSERT INTO leave_balance_transactions(organization_id,entitlement_id,leave_request_id,transaction_type,units,reason,created_by_user_id) VALUES($1,$2,$3,'restoration',$4,$5,$6)",
        [
          input.organizationId,
          usage.entitlement_id,
          id,
          Math.abs(Number(usage.units)),
          `Pengembalian saldo karena pembatalan: ${input.reason}`,
          actor.id,
        ],
      );
    await writeAudit(client, {
      organizationId: input.organizationId,
      actorUserId: actor.id,
      action: "leave_request.cancel",
      entityType: "leave_request",
      entityId: id,
      beforeData: { status: before.status },
      afterData: { status: "cancelled", reason: input.reason },
      requestId,
    });
    await client.query(
      "INSERT INTO integration_outbox(organization_id,event_type,aggregate_type,aggregate_id,payload) VALUES($1,'leave_request.cancelled','leave_request',$2,$3::jsonb)",
      [
        input.organizationId,
        String(id),
        JSON.stringify({ requestId: String(id), employeeId: String(before.employee_id) }),
      ],
    );
    return { id: String(id), status: "cancelled" };
  });
}

export async function getEmployeeLeaveSummary(
  employeeId,
  organizationId,
  actor,
  year = new Date().getFullYear(),
) {
  await ensureActorEmployeeAccess(actor, employeeId, organizationId);
  const [employee, balances, requests] = await Promise.all([
    pool.query(
      "SELECT id::text,employee_no,full_name,employment_status FROM employees WHERE id=$1 AND organization_id=$2 AND deleted_at IS NULL",
      [employeeId, organizationId],
    ),
    pool.query(
      `SELECT entitlement.id::text,entitlement.leave_type_id::text,type.name,type.category,type.unit,type.annual_allowance,
      entitlement.period_start::text,entitlement.period_end::text,entitlement.updated_at,
      COALESCE(sum(transaction.units),0)::numeric AS balance,
      COALESCE(jsonb_agg(jsonb_build_object('id',transaction.id::text,'type',transaction.transaction_type,'units',transaction.units,'reason',transaction.reason,'createdAt',transaction.created_at,'actor',identity.display_name) ORDER BY transaction.created_at DESC,transaction.id DESC) FILTER(WHERE transaction.id IS NOT NULL),'[]'::jsonb) AS transactions
      FROM leave_entitlements entitlement JOIN leave_types type ON type.organization_id=entitlement.organization_id AND type.id=entitlement.leave_type_id
      LEFT JOIN leave_balance_transactions transaction ON transaction.organization_id=entitlement.organization_id AND transaction.entitlement_id=entitlement.id
      LEFT JOIN v_user_identity identity ON identity.user_id=transaction.created_by_user_id
      WHERE entitlement.organization_id=$1 AND entitlement.employee_id=$2 AND extract(year FROM entitlement.period_start)=$3
      GROUP BY entitlement.id,type.id ORDER BY type.name`,
      [organizationId, employeeId, year],
    ),
    pool.query(
      `${REQUEST_SELECT} WHERE request.organization_id=$1 AND request.employee_id=$2 AND extract(year FROM request.start_at)=$3 ORDER BY request.start_at DESC,request.id DESC`,
      [organizationId, employeeId, year],
    ),
  ]);
  if (!employee.rows[0])
    throw new ServiceError("EMPLOYEE_NOT_FOUND", "Pegawai tidak ditemukan.", 404);
  return { employee: employee.rows[0], year, balances: balances.rows, requests: requests.rows };
}

export async function adjustLeaveBalance(employeeId, entitlementId, input, actor, requestId) {
  return withTransaction(async (client) => {
    await ensureActorEmployeeAccess(actor, employeeId, input.organizationId, client);
    const entitlement = (
      await client.query(
        "SELECT * FROM leave_entitlements WHERE id=$1 AND organization_id=$2 AND employee_id=$3 FOR UPDATE",
        [entitlementId, input.organizationId, employeeId],
      )
    ).rows[0];
    if (!entitlement)
      throw new ServiceError("LEAVE_ENTITLEMENT_NOT_FOUND", "Saldo cuti tidak ditemukan.", 404);
    const units = input.transactionType === "carryover" ? Math.abs(input.units) : input.units;
    const current = Number(
      (
        await client.query(
          "SELECT COALESCE(sum(units),0) AS balance FROM leave_balance_transactions WHERE organization_id=$1 AND entitlement_id=$2",
          [input.organizationId, entitlementId],
        )
      ).rows[0].balance,
    );
    if (current + Number(units) < 0)
      throw new ServiceError(
        "LEAVE_BALANCE_NEGATIVE",
        "Penyesuaian akan membuat saldo menjadi negatif.",
        409,
        { units: "Jumlah pengurangan melebihi saldo tersedia." },
      );
    const inserted = await client.query(
      "INSERT INTO leave_balance_transactions(organization_id,entitlement_id,transaction_type,units,reason,created_by_user_id) VALUES($1,$2,$3,$4,$5,$6) RETURNING id",
      [input.organizationId, entitlementId, input.transactionType, units, input.reason, actor.id],
    );
    await writeAudit(client, {
      organizationId: input.organizationId,
      actorUserId: actor.id,
      action: "leave_balance.adjust",
      entityType: "leave_entitlement",
      entityId: entitlementId,
      beforeData: { balance: current },
      afterData: { units, type: input.transactionType, reason: input.reason },
      requestId,
    });
    return { id: String(inserted.rows[0].id), balance: current + Number(units) };
  });
}
