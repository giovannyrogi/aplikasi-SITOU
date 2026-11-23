import { createHash } from "node:crypto";
import { z } from "zod";
import pool from "@/lib/dbConfig";
import { ServiceError } from "@/lib/api/routeHelpers";
import { writeAudit } from "@/lib/audit";
import { ensureActorEmployeeAccess } from "@/lib/auth/permissions";
import { commitPreparedEmployeeFile, getStoredFile } from "@/lib/files/storage";
import { context } from "@/lib/work-schedules/repository";
import { resolveDays } from "@/lib/work-schedules/service";
import { localDate } from "@/lib/work-schedules/rules.mjs";
import { requestNumber, ensureEntitlement } from "./service";
import { isLeaveTypeEligible } from "./eligibility.mjs";

const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(value + "T00:00:00Z");
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, "Pilih tanggal yang valid.");
export const leaveInput = z.strictObject({
  existingRequestId: z.coerce.number().int().positive().optional(),
  leaveTypeId: z.coerce.number().int().positive(),
  startDate: date,
  endDate: date,
  sessionNo: z.coerce.number().int().positive().optional(),
  startsAt: z.string().datetime({ offset: true }).optional(),
  endsAt: z.string().datetime({ offset: true }).optional(),
  reason: z.string().trim().min(10, "Alasan minimal 10 karakter.").max(2000),
  requestKey: z.string().uuid().optional(),
  version: z.string().datetime().optional(),
});
export const leaveAction = z.strictObject({
  action: z.enum(["documents", "resubmit", "cancel", "approve", "reject", "revise"]),
  requestKey: z.string().uuid(),
  version: z.string().datetime(),
  notes: z.string().trim().min(10, "Catatan minimal 10 karakter.").max(2000).optional(),
  data: leaveInput.optional(),
});
const fail = (code, message, field, status = 422) => {
  throw new ServiceError(code, message, status, field ? { [field]: message } : undefined);
};
export const policyOf = (t) => ({
  id: String(t.id),
  name: t.name,
  unit: t.unit,
  usesBalance: t.uses_balance,
  annualAllowance: t.annual_allowance,
  requiresAttachment: t.requires_attachment,
  documentKind: t.required_attachment_category,
  templateFileId: t.template_file_id ? String(t.template_file_id) : null,
  documentLabel:
    t.required_attachment_category === "medical_letter"
      ? "Surat dokter"
      : t.required_attachment_category === "organization_form"
        ? "Formulir organisasi"
        : t.attachment_label || "Dokumen pendukung",
  instructions: t.document_instructions || null,
  version: new Date(t.updated_at).toISOString(),
});

async function employee(db, actor, lock = false, write = true) {
  const r = await db.query(
    `SELECT id,gender,employment_status,joined_date::text FROM employees
    WHERE organization_id=$1 AND id=$2 AND deleted_at IS NULL ${lock ? "FOR NO KEY UPDATE" : ""}`,
    [actor.organization_id, actor.employee_id],
  );
  const e = r.rows[0];
  if (!e || (write && !["active", "probation"].includes(e.employment_status)))
    fail("EMPLOYEE_INELIGIBLE", "Profil Pegawai belum dapat mengajukan cuti atau izin.", null, 403);
  return e;
}
async function zone(db, org) {
  const r = await db.query("SELECT timezone FROM organizations WHERE id=$1", [org]);
  return r.rows[0].timezone;
}
async function balance(db, actor, p, year, exclude = null) {
  if (!p.usesBalance) return null;
  const r = await db.query(
    `SELECT e.id,COALESCE(sum(t.units),0)::int AS units
    FROM leave_entitlements e LEFT JOIN leave_balance_transactions t ON (t.organization_id,t.entitlement_id)=(e.organization_id,e.id)
    WHERE e.organization_id=$1 AND e.employee_id=$2 AND e.leave_type_id=$3 AND e.period_start=$4 GROUP BY e.id`,
    [actor.organization_id, actor.employee_id, p.id, `${year}-01-01`],
  );
  const remaining = r.rowCount ? Number(r.rows[0].units) : Number(p.annualAllowance || 0);
  const reserved = await db.query(
    `SELECT COALESCE(sum(requested_units),0)::int AS units FROM leave_requests
    WHERE organization_id=$1 AND employee_id=$2 AND leave_type_id=$3 AND status IN ('submitted','needs_revision')
    AND (start_at AT TIME ZONE (SELECT timezone FROM organizations WHERE id=$1))::date BETWEEN $4::date AND $5::date
    AND ($6::bigint IS NULL OR id<>$6)`,
    [actor.organization_id, actor.employee_id, p.id, `${year}-01-01`, `${year}-12-31`, exclude],
  );
  return {
    remaining,
    reserved: reserved.rows[0].units,
    available: remaining - reserved.rows[0].units,
  };
}
export async function leaveOptions(actor, workDate = null) {
  const person = await employee(pool, actor, false, false);
  const timezone = await zone(pool, actor.organization_id);
  const today = localDate(new Date(), timezone);
  const r = await pool.query(
    `SELECT t.* FROM leave_types t JOIN employees e ON e.organization_id=t.organization_id AND e.id=$2
    WHERE t.organization_id=$1 AND t.is_active AND (t.eligible_gender='all' OR t.eligible_gender=e.gender) ORDER BY t.name`,
    [actor.organization_id, actor.employee_id],
  );
  const types = await Promise.all(
    r.rows.map(async (t) => ({
      ...policyOf(t),
      balance: await balance(pool, actor, policyOf(t), today.slice(0, 4)),
    })),
  );
  let days = [];
  if (workDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate))
      fail("INVALID_DATE", "Pilih tanggal yang valid.", "startDate");
    days = await resolveDays(
      pool,
      actor.organization_id,
      actor.employee_id,
      workDate,
      workDate,
      await context(pool, actor.organization_id),
      timezone,
    );
  }
  return {
    timezone,
    today,
    types,
    sessions: days[0]?.sessions || [],
    canSubmit: ["active", "probation"].includes(person.employment_status),
  };
}
export async function previewLeave(db, actor, input, existing = null, { allowPast = false } = {}) {
  const e = await employee(db, actor);
  const timezone = await zone(db, actor.organization_id);
  const unchangedPeriod =
    existing?.schedule_snapshot?.workDate === input.startDate &&
    existing?.schedule_snapshot?.throughDate === input.endDate;
  if (!allowPast && !unchangedPeriod && input.startDate < localDate(new Date(), timezone))
    fail("LEAVE_DATE_IN_PAST", "Pilih tanggal mulai hari ini atau setelahnya.", "startDate");
  const type = await db.query("SELECT * FROM leave_types WHERE organization_id=$1 AND id=$2", [
    actor.organization_id,
    input.leaveTypeId,
  ]);
  const t = type.rows[0];
  if (!t || !t.is_active || !isLeaveTypeEligible(t.eligible_gender, e.gender))
    fail("LEAVE_TYPE_INELIGIBLE", "Jenis cuti atau izin tidak tersedia.", "leaveTypeId");
  const p = existing?.policy_snapshot || policyOf(t);
  if (
    input.startDate < input.endDate &&
    p.usesBalance &&
    input.startDate.slice(0, 4) !== input.endDate.slice(0, 4)
  )
    fail("CROSS_YEAR_LEAVE_NOT_ALLOWED", "Buat pengajuan terpisah untuk setiap tahun.", "endDate");
  if (
    input.startDate > input.endDate ||
    input.startDate < e.joined_date ||
    !Number.isFinite(Date.parse(input.startDate)) ||
    (Date.parse(input.endDate) - Date.parse(input.startDate)) / 86400000 > 366
  )
    fail("INVALID_PERIOD", "Pilih periode dalam masa kerja, maksimal 367 hari.", "startDate");
  const days = await resolveDays(
    db,
    actor.organization_id,
    actor.employee_id,
    input.startDate,
    input.endDate,
    await context(db, actor.organization_id),
    timezone,
  );
  if (days.some((d) => d.status === "needs_review"))
    fail("SCHEDULE_UNAVAILABLE", "Jadwal kerja belum tersedia. Hubungi HRD.", "startDate");
  let startsAt,
    endsAt,
    units,
    selected = null;
  if (p.unit === "hour") {
    if (input.startDate !== input.endDate)
      fail("INVALID_PERIOD", "Pilih satu tanggal kerja untuk izin per jam.", "endDate");
    selected = days[0]?.sessions.find((s) => s.sessionNo == input.sessionNo);
    startsAt = input.startsAt;
    endsAt = input.endsAt;
    const duration = (Date.parse(endsAt) - Date.parse(startsAt)) / 3600000;
    if (
      !selected ||
      !Number.isInteger(duration) ||
      duration < 1 ||
      Date.parse(startsAt) < Date.parse(selected.startsAt) ||
      Date.parse(endsAt) > Date.parse(selected.endsAt)
    )
      fail("INVALID_TIME", "Pilih waktu dalam jadwal kerja dengan durasi jam bulat.", "startsAt");
    units = duration;
  } else {
    units = days.filter((d) => d.status === "scheduled" && d.sessions.length).length;
    if (!units) fail("NO_WORKING_DAYS", "Tidak ada hari kerja pada periode ini.", "startDate");
    const timestamps = await db.query(
      `SELECT $1::date::timestamp AT TIME ZONE $3 AS start,
      ($2::date+1)::timestamp AT TIME ZONE $3 AS finish`,
      [input.startDate, input.endDate, timezone],
    );
    startsAt = timestamps.rows[0].start.toISOString();
    endsAt = new Date(timestamps.rows[0].finish.getTime() - 1).toISOString();
  }
  const overlap = await db.query(
    `SELECT id FROM leave_requests WHERE organization_id=$1 AND employee_id=$2
    AND status IN ('submitted','needs_revision','approved') AND ($3::bigint IS NULL OR id<>$3)
    AND start_at<$5::timestamptz AND end_at>$4::timestamptz LIMIT 1`,
    [actor.organization_id, actor.employee_id, existing?.id || null, startsAt, endsAt],
  );
  if (overlap.rowCount)
    fail("LEAVE_PERIOD_OVERLAP", "Periode bertumpuk dengan cuti atau izin lain.", "startDate", 409);
  const available = await balance(db, actor, p, input.startDate.slice(0, 4), existing?.id);
  if (available && available.available < units)
    fail(
      "LEAVE_BALANCE_INSUFFICIENT",
      `Saldo tersedia ${available.available} ${p.unit === "day" ? "hari" : "jam"}.`,
      "startDate",
      409,
    );
  return {
    policy: p,
    timezone,
    startsAt,
    endsAt,
    units,
    balance: available,
    schedule: {
      unit: p.unit,
      workDate: input.startDate,
      throughDate: input.endDate,
      session: selected,
      days: days.map((d) => ({ date: d.date, status: d.status, sessions: d.sessions })),
      version: 1,
    },
  };
}
async function attachments(db, org, id) {
  return (
    await db.query(
      `SELECT f.id::text,f.original_name AS name,f.mime_type AS "mimeType",f.size_bytes AS size
  FROM leave_request_attachments a JOIN stored_files f ON (f.organization_id,f.id)=(a.organization_id,a.file_id)
  WHERE a.organization_id=$1 AND a.leave_request_id=$2 AND a.is_current AND f.deleted_at IS NULL AND f.lifecycle_status='active'`,
      [org, id],
    )
  ).rows;
}
export async function leaveDetail(db, actor, id, { staff = false, lock = false } = {}) {
  const r = await db.query(
    `SELECT r.*,e.full_name,e.employee_no,t.name AS current_name,t.unit AS current_unit,
    o.timezone FROM leave_requests r JOIN employees e ON (e.organization_id,e.id)=(r.organization_id,r.employee_id)
    JOIN leave_types t ON (t.organization_id,t.id)=(r.organization_id,r.leave_type_id)
    JOIN organizations o ON o.id=r.organization_id
    WHERE r.organization_id=$1 AND r.id=$2 ${staff ? "" : "AND r.employee_id=$3 AND r.status<>'draft'"} ${lock ? "FOR UPDATE OF r" : ""}`,
    staff ? [actor.organization_id, id] : [actor.organization_id, id, actor.employee_id],
  );
  const row = r.rows[0];
  if (!row) fail("LEAVE_NOT_FOUND", "Pengajuan tidak ditemukan.", null, 404);
  if (staff) await ensureActorEmployeeAccess(actor, row.employee_id, actor.organization_id, db);
  const files = await attachments(db, actor.organization_id, id);
  const p = row.policy_snapshot;
  const displayStatus =
    row.status === "submitted" && p?.requiresAttachment && !files.length
      ? "waiting_documents"
      : row.status;
  const history = (
    await db.query(
      `SELECT action,occurred_at AS created_at,after_data->>'notes' AS notes FROM audit_logs
    WHERE organization_id=$1 AND entity_type='leave_request' AND entity_id=$2 AND action LIKE 'leave_request.%'
    ORDER BY occurred_at,id`,
      [actor.organization_id, String(id)],
    )
  ).rows;
  const decision =
    (
      await db.query(
        `SELECT decision,notes,decided_at FROM leave_decisions WHERE organization_id=$1 AND leave_request_id=$2`,
        [actor.organization_id, id],
      )
    ).rows[0] || null;
  return {
    ...row,
    id: String(row.id),
    employee_id: String(row.employee_id),
    leave_type_id: String(row.leave_type_id),
    leave_type_name: p?.name || row.current_name,
    unit: p?.unit || row.current_unit,
    status: displayStatus,
    rawStatus: row.status,
    start_date: localDate(row.start_at, row.timezone),
    end_date: localDate(row.end_at, row.timezone),
    attachments: files,
    history,
    decision,
    version: row.updated_at.toISOString(),
    canEdit: row.status === "needs_revision",
    canUpload: ["submitted", "needs_revision"].includes(row.status),
    canCancel: ["submitted", "needs_revision"].includes(row.status),
  };
}
export async function leaveList(actor, { before = null, staff = false } = {}) {
  const r = await pool.query(
    `SELECT id::text FROM leave_requests WHERE organization_id=$1
    AND ($2::bigint IS NULL OR employee_id=$2) AND status<>'draft' AND ($3::bigint IS NULL OR id<$3)
    ORDER BY id DESC LIMIT 21`,
    [actor.organization_id, staff ? null : actor.employee_id, before],
  );
  const items = await Promise.all(
    r.rows.slice(0, 20).map((row) => leaveDetail(pool, actor, row.id, { staff })),
  );
  return { requests: items, nextCursor: r.rowCount > 20 ? r.rows[19].id : null };
}
class Replay extends Error {
  constructor(result) {
    super("replay");
    this.result = result;
  }
}
export async function mutateLeave(
  actor,
  input,
  id,
  operation,
  file,
  requestId,
  { staff = false, authorize = null } = {},
) {
  const key = input.requestKey;
  if (!key) fail("REQUEST_KEY_REQUIRED", "Kirim ulang pengajuan melalui formulir.", null, 400);
  const sha = file
    ? createHash("sha256")
        .update(Buffer.from(await file.arrayBuffer()))
        .digest("hex")
    : null;
  const digest = createHash("sha256")
    .update(JSON.stringify({ input, id: id || null, operation, sha }))
    .digest("hex");
  let owner = actor.employee_id;
  if (staff) owner = (await leaveDetail(pool, actor, id, { staff: true })).employee_id;
  try {
    return await commitPreparedEmployeeFile(
      {
        file,
        fileKind: "lampiran_cuti",
        employeeId: owner,
        organizationId: actor.organization_id,
        actor,
        requestId,
      },
      async (db, stored) => {
        if (authorize) await authorize(db);
        await db.query("SET LOCAL lock_timeout='3s'");
        await db.query("SET LOCAL statement_timeout='10s'");
        await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
          `${actor.organization_id}:${actor.id}:${key}`,
        ]);
        const old = await db.query(
          "SELECT * FROM leave_request_operations WHERE organization_id=$1 AND actor_user_id=$2 AND request_key=$3",
          [actor.organization_id, actor.id, key],
        );
        if (old.rowCount) {
          if (old.rows[0].payload_hash !== digest)
            fail(
              "IDEMPOTENCY_CONFLICT",
              "Identitas kiriman sudah dipakai untuk data lain.",
              null,
              409,
            );
          throw new Replay(old.rows[0].result);
        }
        const person = { ...actor, employee_id: owner };
        await employee(db, person, true);
        await db.query(
          "SELECT id FROM leave_entitlements WHERE organization_id=$1 AND employee_id=$2 ORDER BY id FOR UPDATE",
          [actor.organization_id, owner],
        );
        let row = id ? await leaveDetail(db, actor, id, { staff, lock: true }) : null;
        if (row && row.version !== input.version)
          fail(
            "VERSION_CONFLICT",
            "Pengajuan sudah berubah. Muat ulang untuk melanjutkan.",
            null,
            409,
          );
        if (row && !["submitted", "needs_revision"].includes(row.rawStatus))
          fail("LEAVE_FINAL", "Pengajuan sudah memiliki keputusan akhir.", null, 409);
        if (staff && String(row.created_by_user_id) === String(actor.id) && operation === "approve")
          fail(
            "SELF_APPROVAL_FORBIDDEN",
            "Pengajuan sendiri harus diperiksa HRD lain atau Admin SITOU.",
            null,
            403,
          );
        let p = row?.policy_snapshot;
        if (operation === "create" || operation === "resubmit") {
          if (row && row.rawStatus !== "needs_revision")
            fail("LEAVE_NOT_EDITABLE", "Pengajuan belum dapat diperbaiki.", null, 409);
          const data = operation === "create" ? input : input.data;
          if (!data) fail("VALIDATION_ERROR", "Lengkapi isian pengajuan.");
          if (row && String(data.leaveTypeId) !== row.leave_type_id)
            fail("LEAVE_TYPE_FIXED", "Jenis cuti tidak dapat diganti.", "leaveTypeId");
          const preview = await previewLeave(db, person, data, row);
          p = preview.policy;
          if (operation === "create") {
            const number = await requestNumber(db, actor.organization_id, data.startDate);
            const inserted = await db.query(
              `INSERT INTO leave_requests(organization_id,request_no,employee_id,leave_type_id,
          start_at,end_at,requested_units,reason,submission_source,status,submitted_at,created_by_user_id,policy_snapshot,schedule_snapshot)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,'employee_mobile','submitted',now(),$9,$10,$11) RETURNING id`,
              [
                actor.organization_id,
                number,
                owner,
                data.leaveTypeId,
                preview.startsAt,
                preview.endsAt,
                preview.units,
                data.reason,
                actor.id,
                JSON.stringify(p),
                JSON.stringify(preview.schedule),
              ],
            );
            id = String(inserted.rows[0].id);
          } else
            await db.query(
              `UPDATE leave_requests SET start_at=$3,end_at=$4,requested_units=$5,reason=$6,
        schedule_snapshot=$7,status='submitted',submitted_at=now() WHERE organization_id=$1 AND id=$2`,
              [
                actor.organization_id,
                id,
                preview.startsAt,
                preview.endsAt,
                preview.units,
                data.reason,
                JSON.stringify(preview.schedule),
              ],
            );
        } else if (operation === "documents") {
          if (!stored) fail("DOCUMENT_REQUIRED", "Pilih dokumen yang akan diunggah.", "file");
        } else if (operation === "revise") {
          if (!input.notes)
            fail("NOTES_REQUIRED", "Jelaskan bagian yang perlu diperbaiki.", "notes");
          await db.query(
            `UPDATE leave_requests SET status='needs_revision',review_notes=$3,reviewed_by_user_id=$4,reviewed_at=now()
        WHERE organization_id=$1 AND id=$2`,
            [actor.organization_id, id, input.notes, actor.id],
          );
        } else if (operation === "approve" || operation === "reject") {
          if (operation === "approve") {
            if (row.rawStatus !== "submitted")
              fail(
                "REVISION_REQUIRED",
                "Pegawai perlu mengajukan kembali perbaikannya.",
                null,
                409,
              );
            if (p?.requiresAttachment && !row.attachments.length)
              fail("DOCUMENT_REQUIRED", "Dokumen wajib belum dilengkapi.", "file");
            if (p?.requiresAttachment) {
              for (const a of row.attachments) await getStoredFile(a.id, actor.organization_id, db);
            }
            const currentType = (
              await db.query("SELECT * FROM leave_types WHERE organization_id=$1 AND id=$2", [
                actor.organization_id,
                row.leave_type_id,
              ])
            ).rows[0];
            if (!currentType?.is_active)
              fail("LEAVE_TYPE_INACTIVE", "Jenis cuti atau izin sudah tidak aktif.");
            const schedule = row.schedule_snapshot;
            const checked = await previewLeave(
              db,
              person,
              {
                leaveTypeId: Number(row.leave_type_id),
                startDate: schedule.workDate,
                endDate: schedule.throughDate,
                sessionNo: schedule.session?.sessionNo,
                startsAt: row.start_at.toISOString(),
                endsAt: row.end_at.toISOString(),
                reason: row.reason,
              },
              row,
              { allowPast: true },
            );
            if (checked.units !== row.requested_units)
              fail(
                "SCHEDULE_CHANGED",
                "Jadwal telah berubah. Minta Pegawai memperbaiki pengajuan.",
                null,
                409,
              );
            if (p?.usesBalance) {
              const type = {
                ...currentType,
                id: row.leave_type_id,
                annual_allowance: p.annualAllowance,
              };
              const entitlement = await ensureEntitlement(db, {
                organizationId: actor.organization_id,
                employeeId: owner,
                leaveType: type,
                year: Number(schedule.workDate.slice(0, 4)),
                actor,
              });
              await db.query(
                `INSERT INTO leave_balance_transactions(organization_id,entitlement_id,leave_request_id,transaction_type,units,reason,created_by_user_id)
            VALUES($1,$2,$3,'usage',$4,$5,$6)`,
                [
                  actor.organization_id,
                  entitlement.id,
                  id,
                  -row.requested_units,
                  `Pemakaian untuk ${row.request_no}`,
                  actor.id,
                ],
              );
            }
            await db.query(
              `INSERT INTO integration_outbox(organization_id,event_type,aggregate_type,aggregate_id,payload)
          VALUES($1,'leave_request.approved','leave_request',$2,$3)`,
              [
                actor.organization_id,
                String(id),
                JSON.stringify({
                  requestId: String(id),
                  employeeId: String(owner),
                  startDate: row.start_date,
                  endDate: row.end_date,
                }),
              ],
            );
          } else if (!input.notes) fail("NOTES_REQUIRED", "Isi alasan penolakan.", "notes");
          await db.query(
            `INSERT INTO leave_decisions(organization_id,leave_request_id,decision,decided_by_user_id,decision_role,notes)
        VALUES($1,$2,$3,$4,$5,$6)`,
            [
              actor.organization_id,
              id,
              operation === "approve" ? "approved" : "rejected",
              actor.id,
              actor.role_code === "superadmin" ? "superadmin" : "hrd",
              input.notes || null,
            ],
          );
          await db.query("UPDATE leave_requests SET status=$3 WHERE organization_id=$1 AND id=$2", [
            actor.organization_id,
            id,
            operation === "approve" ? "approved" : "rejected",
          ]);
        } else if (operation === "cancel") {
          if (!input.notes) fail("NOTES_REQUIRED", "Isi alasan pembatalan.", "notes");
          await db.query(
            `UPDATE leave_requests SET status='cancelled',cancelled_at=now(),cancelled_by_user_id=$3,cancellation_reason=$4
        WHERE organization_id=$1 AND id=$2`,
            [actor.organization_id, id, actor.id, input.notes],
          );
        } else fail("INVALID_ACTION", "Tindakan tidak tersedia.", null, 400);
        if (stored) {
          if (!["create", "resubmit", "documents"].includes(operation))
            fail("UNEXPECTED_FILE", "Dokumen tidak diperlukan untuk tindakan ini.", "file");
          await db.query(
            "UPDATE leave_request_attachments SET is_current=false WHERE organization_id=$1 AND leave_request_id=$2 AND is_current",
            [actor.organization_id, id],
          );
          await db.query(
            "INSERT INTO leave_request_attachments(organization_id,leave_request_id,file_id,attachment_category) VALUES($1,$2,$3,$4)",
            [actor.organization_id, id, stored.id, p?.documentKind || "leave_attachment"],
          );
        }
        await db.query(
          "UPDATE leave_requests SET updated_at=clock_timestamp(),template_file_id=(policy_snapshot->>'templateFileId')::bigint WHERE organization_id=$1 AND id=$2",
          [actor.organization_id, id],
        );
        const changed = (
          await db.query(
            "SELECT status,start_at,end_at,requested_units,reason FROM leave_requests WHERE organization_id=$1 AND id=$2",
            [actor.organization_id, id],
          )
        ).rows[0];
        await writeAudit(db, {
          organizationId: actor.organization_id,
          actorUserId: actor.id,
          action: `leave_request.${operation}`,
          entityType: "leave_request",
          entityId: id,
          beforeData: row
            ? {
                status: row.rawStatus,
                start_at: row.start_at,
                end_at: row.end_at,
                requested_units: row.requested_units,
                reason: row.reason,
              }
            : undefined,
          afterData: { ...changed, notes: input.notes || null, uploadedFileId: stored?.id || null },
          requestId,
        });
        const result = await leaveDetail(db, actor, id, { staff });
        await db.query(
          "INSERT INTO leave_request_operations(organization_id,actor_user_id,request_key,operation,payload_hash,result) VALUES($1,$2,$3,$4,$5,$6)",
          [actor.organization_id, actor.id, key, operation, digest, JSON.stringify(result)],
        );
        return result;
      },
    );
  } catch (error) {
    if (error instanceof Replay) return error.result;
    throw error;
  }
}
