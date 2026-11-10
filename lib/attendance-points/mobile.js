import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { assessAttendance } from "./timing.mjs";
import { holidayWorkSession } from "./holiday-work.mjs";
import { refreshAttendanceSummaries } from "./summaries.mjs";
import { z } from "zod";
import pool from "@/lib/dbConfig";
import { withTransaction } from "@/lib/dbTransaction";
import { actorHasPermission } from "@/lib/auth/permissions";
import { requireMobileUser } from "@/lib/auth/mobile/service";
import { requireAttendanceModule } from "@/lib/access/organizationModuleAccess";
import { commitPreparedEmployeeFile } from "@/lib/files/storage";
import { parseMultipartToPrivateTemp } from "@/lib/api/multipart";
import {
  errorResponse,
  getRequestId,
  readJson,
  ServiceError,
  successResponse,
  validateMutationRequest,
  validateRequestOrigin,
} from "@/lib/api/routeHelpers";
import { context } from "@/lib/work-schedules/repository";
import { HASH, resolveDays } from "@/lib/work-schedules/service";
import { absoluteTime, addDays, dateValid, minute } from "@/lib/work-schedules/rules.mjs";

const id = z.string().regex(/^[1-9]\d{0,17}$/);
const action = z.enum(["check_in", "check_out"]);
const check = z
  .object({
    action,
    workDate: z.string().refine(dateValid),
    sessionNo: z.number().int().min(1).max(16),
    pointId: id,
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    accuracy: z.number().positive().max(50000),
  })
  .strict();
const submission = check.extend({
  clientEventId: z.string().uuid(),
  proof: z.string().min(1).max(1024),
  note: z.string().trim().max(500).optional(),
});
const fail = (code, message, status = 422) => {
  throw new ServiceError(code, message, status);
};
const auth = (u) => ({
  id: u.id,
  organization_id: u.organizationId,
  employee_id: u.employeeId,
  role_code: u.role,
});
const rad = (n) => (n * Math.PI) / 180;
function distance(a, b) {
  const h =
    Math.sin(rad(b.latitude - a.latitude) / 2) ** 2 +
    Math.cos(rad(a.latitude)) *
      Math.cos(rad(b.latitude)) *
      Math.sin(rad(b.longitude - a.longitude) / 2) ** 2;
  return 12742000 * Math.asin(Math.sqrt(Math.min(1, h)));
}
async function state(db, actor) {
  const org = actor.organization_id,
    employee = actor.employee_id;
  await requireAttendanceModule(db, org);
  const clock = (
    await db.query(
      `SELECT clock.instant AS now, o.timezone, o.attendance_map_provider,
    (clock.instant AT TIME ZONE o.timezone)::date::text AS today
    FROM organizations o JOIN employees e ON e.organization_id=o.id
    CROSS JOIN (SELECT clock_timestamp() AS instant) clock
    WHERE o.id=$1 AND o.is_active AND e.id=$2 AND e.deleted_at IS NULL
    AND e.employment_status IN ('active','probation','suspended')
    AND e.joined_date <= (clock.instant AT TIME ZONE o.timezone)::date`,
      [org, employee],
    )
  ).rows[0];
  if (!clock) fail("EMPLOYEE_UNAVAILABLE", "Profil Pegawai tidak tersedia.", 403);
  const { now, timezone, today } = clock;
  const points = (
    await db.query(
      `SELECT p.id::text,p.name,p.location_id::text AS "locationId",p.latitude::float8,p.longitude::float8,
      p.radius_m AS radius,p.max_accuracy_m AS "maxAccuracy"
    FROM attendance_points p JOIN locations l ON l.organization_id=p.organization_id AND l.id=p.location_id
    WHERE p.organization_id=$1 AND p.is_active AND l.is_active
      AND p.max_accuracy_m IS NOT NULL AND NOT p.requires_liveness AND NOT p.requires_background_match
      AND p.active_from <= $3 AND (p.active_until IS NULL OR p.active_until >= $3)
      AND l.operational_from <= $3 AND (l.operational_until IS NULL OR l.operational_until >= $3)
      AND EXISTS (SELECT 1 FROM attendance_point_assignments a
        WHERE a.organization_id=p.organization_id AND a.attendance_point_id=p.id AND a.revoked_at IS NULL
        AND a.effective_from <= $3 AND (a.effective_until IS NULL OR a.effective_until >= $3)
        AND (a.employee_id=$2 OR a.location_id IN (SELECT location_id FROM employee_assignments
          WHERE organization_id=$1 AND employee_id=$2 AND assignment_type='primary'
          AND effective_from <= $3 AND (effective_until IS NULL OR effective_until >= $3))))
    ORDER BY p.name,p.id`,
      [org, employee, today],
    )
  ).rows;
  const events = (
    await db.query(
      `SELECT e.event_type,e.occurred_at,d.work_date::text,s.session_no
    FROM attendance_events e LEFT JOIN work_schedule_sessions s ON s.organization_id=e.organization_id AND s.id=e.schedule_session_id
    JOIN employee_daily_schedules d ON d.organization_id=e.organization_id AND d.id=e.daily_schedule_id
    WHERE e.organization_id=$1 AND e.employee_id=$2 AND e.validation_status='valid'
      AND (e.schedule_session_id IS NOT NULL OR e.work_context='holiday_work')
      AND (d.work_date >= $3 OR e.daily_schedule_id IN (SELECT latest.daily_schedule_id FROM attendance_events latest
        WHERE latest.organization_id=$1 AND latest.employee_id=$2 AND latest.daily_schedule_id IS NOT NULL
          AND latest.validation_status='valid' AND latest.event_type='check_in' ORDER BY latest.occurred_at DESC LIMIT 2))
    ORDER BY e.occurred_at`,
      [org, employee, addDays(today, -1)],
    )
  ).rows;
  const lastIn = events.findLast((e) => e.event_type === "check_in");
  const from = addDays(today, -1);
  const ctx = await context(db, org);
  const days = await resolveDays(db, org, employee, from, today, ctx, timezone);
  const olderDates = [
    ...new Set(events.map((event) => event.work_date).filter((date) => date < from)),
  ];
  for (const date of olderDates.sort().reverse()) {
    days.unshift(...(await resolveDays(db, org, employee, date, date, ctx, timezone)));
  }
  const sessions = days
    .flatMap((day) =>
      [...day.sessions, ...[holidayWorkSession(day)].filter(Boolean)].map((s) => {
        const match = events.filter(
          (e) => e.work_date === day.date && (e.session_no ?? 1) === s.sessionNo,
        );
        const entered = match.find((e) => e.event_type === "check_in")?.occurred_at;
        const exited = match.find((e) => e.event_type === "check_out")?.occurred_at;
        const rules = s.rules;
        const newer =
          lastIn &&
          (lastIn.work_date > day.date ||
            (lastIn.work_date === day.date && lastIn.occurred_at > entered));
        const previous = day.sessions
          .filter((x) => Date.parse(x.endsAt) <= Date.parse(s.startsAt))
          .sort((a, b) => Date.parse(b.endsAt) - Date.parse(a.endsAt))[0];
        const start = rules.windowStart
          ? absoluteTime(day.date, minute(rules.windowStart), timezone)
          : previous?.endsAt || absoluteTime(day.date, 0, timezone);
        let actions = [];
        if (entered && !exited && !newer) actions = ["check_out"];
        if (
          !entered &&
          !exited &&
          day.date === today &&
          now >= new Date(start) &&
          (s.holidayWork || now < new Date(s.endsAt)) &&
          (!rules.windowEnd ||
            now <= new Date(absoluteTime(day.date, minute(rules.windowEnd), timezone)))
        )
          actions = ["check_in"];
        return {
          ...s,
          workDate: day.date,
          entered,
          exited,
          actions,
          missedExit: Boolean(entered && !exited && newer),
        };
      }),
    )
    .filter((s) => s.workDate === today || s.actions.length || s.missedExit);
  // Close a previous work period before starting unplanned work on a day off.
  if (sessions.some((s) => s.actions.includes("check_out")))
    for (const session of sessions)
      if (session.holidayWork) session.actions = session.actions.filter((a) => a !== "check_in");
  return {
    now,
    timezone,
    today,
    points,
    sessions,
    days,
    status: days.at(-1)?.status,
    mapProvider: clock.attendance_map_provider,
  };
}
function validate(s, input) {
  const session = s.sessions.find(
    (x) => x.workDate === input.workDate && x.sessionNo === input.sessionNo,
  );
  if (!session?.actions.includes(input.action))
    fail("SESSION_UNAVAILABLE", "Sesi absensi tidak tersedia.", 409);
  const point = s.points.find((x) => x.id === input.pointId);
  if (!point) fail("POINT_UNAVAILABLE", "Titik absensi tidak tersedia.");
  if (input.accuracy > point.maxAccuracy)
    fail("GPS_INACCURATE", "Lokasi kurang akurat. Coba lagi.");
  const meters = distance(input, point);
  const outsideRadius = meters > point.radius;
  const requiresNote = outsideRadius || session.holidayWork === true;
  const timing = assessAttendance(session, input.action, s.now);
  return {
    session,
    point,
    meters,
    result: {
      ...timing,
      timingMessage: timing.offerNote ? timing.message : null,
      requiresNote,
      outsideRadius,
      holidayWork: session.holidayWork === true,
      holidayName: session.holidayName || null,
      offerNote: requiresNote || timing.offerNote,
    },
  };
}
function withAttendanceNote(result, note) {
  return { ...result, note: note ?? null };
}
function validateNote(result, note) {
  if (result.holidayWork && !note) fail("HOLIDAY_NOTE_REQUIRED", "Isi alasan bekerja saat libur.");
  if (result.requiresNote && !note)
    fail("OUTSIDE_NOTE_REQUIRED", "Isi alasan absen di luar radius.");
  if (note && !result.offerNote)
    fail("NOTE_UNAVAILABLE", "Catatan tidak diperlukan untuk absensi ini.");
}
function sign(actor, input, session, expiry) {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret || secret.length < 32)
    fail("ATTENDANCE_UNAVAILABLE", "Layanan absensi belum tersedia.", 503);
  return createHmac("sha256", secret)
    .update(
      JSON.stringify([
        "attendance-v1",
        actor.organization_id,
        actor.employee_id,
        input.action,
        input.workDate,
        input.sessionNo,
        input.pointId,
        input.latitude,
        input.longitude,
        input.accuracy,
        session.startsAt,
        session.endsAt,
        session.revisionId,
        session.holidayWork === true,
        expiry,
      ]),
    )
    .digest("hex");
}
async function snapshot(db, actor, s, session) {
  const day = s.days.find((d) => d.date === session.workDate);
  const ids = [actor.organization_id, actor.employee_id, day.date];
  const hash = HASH(day);
  let row = (
    await db.query(
      "SELECT id::text,rule_hash FROM employee_daily_schedules WHERE organization_id=$1 AND employee_id=$2 AND work_date=$3 FOR UPDATE",
      ids,
    )
  ).rows[0];
  if (!day.protected && row?.rule_hash !== hash) {
    const values = [
      ...ids,
      day.sessions[0]?.shiftId,
      day.assignmentId,
      day.sessions[0]?.startsAt,
      day.sessions.at(-1)?.endsAt,
      day.status,
      day.isHoliday,
      day.holidayName,
      day.exceptionId,
      hash,
      day.allowHolidayAttendance,
    ];
    row = (
      await db.query(
        `INSERT INTO employee_daily_schedules(organization_id,employee_id,work_date,shift_id,source_assignment_id,scheduled_start_at,scheduled_end_at,status,is_holiday,holiday_name,source_exception_id,rule_hash,allow_holiday_attendance)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      ON CONFLICT(organization_id,employee_id,work_date) DO UPDATE SET shift_id=$4,source_assignment_id=$5,scheduled_start_at=$6,scheduled_end_at=$7,status=$8,is_holiday=$9,holiday_name=$10,source_exception_id=$11,rule_hash=$12,allow_holiday_attendance=$13,version=employee_daily_schedules.version+1 RETURNING id::text`,
        values,
      )
    ).rows[0];
    await db.query(
      "DELETE FROM work_schedule_sessions WHERE organization_id=$1 AND daily_schedule_id=$2",
      [ids[0], row.id],
    );
    for (const x of day.sessions)
      await db.query(
        `INSERT INTO work_schedule_sessions(organization_id,daily_schedule_id,employee_id,session_no,shift_id,shift_revision_id,starts_at,ends_at,rules)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          ids[0],
          row.id,
          ids[1],
          x.sessionNo,
          x.shiftId,
          x.revisionId,
          x.startsAt,
          x.endsAt,
          x.rules,
        ],
      );
  }
  if (session.holidayWork) return { dailyId: row.id, sessionId: null };
  const item = (
    await db.query(
      "SELECT id::text FROM work_schedule_sessions WHERE organization_id=$1 AND daily_schedule_id=$2 AND session_no=$3",
      [ids[0], row?.id, session.sessionNo],
    )
  ).rows[0];
  if (!item) fail("SESSION_CHANGED", "Jadwal berubah. Periksa kembali.", 409);
  return { dailyId: row.id, sessionId: item.id };
}

async function record(request, actor, requestId) {
  const form = await parseMultipartToPrivateTemp(request);
  try {
    if (
      [...form.keys()].some((k) => !["data", "photo"].includes(k)) ||
      form.getAll("data").length !== 1 ||
      form.getAll("photo").length !== 1
    )
      fail("INVALID_PAYLOAD", "Periksa data dan foto absensi.", 400);
    let raw;
    try {
      raw = JSON.parse(form.get("data"));
    } catch {
      fail("INVALID_PAYLOAD", "Data absensi tidak valid.", 400);
    }
    const parsed = submission.safeParse(raw);
    if (!parsed.success) fail("INVALID_PAYLOAD", "Periksa isian absensi.", 400);
    const input = parsed.data,
      file = form.get("photo");
    if (!file || typeof file.arrayBuffer !== "function" || file.size > 5 * 1024 * 1024)
      fail("PHOTO_INVALID", "Foto absensi tidak valid.", 400);
    const { proof, ...payload } = input;
    const hash = createHash("sha256")
      .update(JSON.stringify(payload))
      .update(Buffer.from(await file.arrayBuffer()))
      .digest("hex");
    const org = actor.organization_id,
      employee = actor.employee_id;
    // A duplicate rolls back the staged upload and returns the original committed result.
    try {
      return await commitPreparedEmployeeFile(
        {
          file,
          fileKind: "attendance_photo",
          organizationId: org,
          employeeId: employee,
          actor,
          requestId,
        },
        async (db, stored) => {
          await db.query("SELECT id FROM organizations WHERE id=$1 FOR NO KEY UPDATE", [org]);
          await requireAttendanceModule(db, org);
          await db.query(
            "SELECT id FROM employees WHERE organization_id=$1 AND id=$2 FOR NO KEY UPDATE",
            [org, employee],
          );
          const existing = (
            await db.query(
              `SELECT r.employee_id::text,r.payload_hash,e.validation_details,e.attendance_note
          FROM attendance_event_receipts r LEFT JOIN attendance_events e ON e.organization_id=r.organization_id AND e.receipt_id=r.id AND e.event_date=r.event_date
          WHERE r.organization_id=$1 AND r.client_event_id=$2`,
              [org, input.clientEventId],
            )
          ).rows[0];
          if (existing) {
            if (
              existing.employee_id !== String(employee) ||
              existing.payload_hash !== hash ||
              !existing.validation_details?.result
            )
              fail("EVENT_CONFLICT", "Permintaan absensi berbeda.", 409);
            throw Object.assign(new Error("Existing attendance"), {
              replay: withAttendanceNote(
                existing.validation_details.result,
                existing.attendance_note,
              ),
            });
          }
          const { user } = await requireMobileUser(request, { write: true, database: db });
          if (
            String(user.employeeId) !== String(employee) ||
            String(user.organizationId) !== String(org)
          )
            fail("SESSION_CHANGED", "Sesi berubah. Masuk kembali.", 401);
          const s = await state(db, actor);
          const { session, point, meters, result } = validate(s, input);
          if (session.holidayWork && request.headers.get("x-sitou-attendance-version") !== "2")
            fail("APP_UPDATE_REQUIRED", "Perbarui aplikasi untuk absen pada hari libur.", 409);
          const [expires, signature] = proof.split(".");
          if (
            !/^\d{13}$/.test(expires) ||
            Number(expires) <= s.now.getTime() ||
            !/^[a-f0-9]{64}$/.test(signature ?? "") ||
            !timingSafeEqual(
              Buffer.from(signature, "hex"),
              Buffer.from(sign(actor, input, session, expires), "hex"),
            )
          )
            fail("LOCATION_RECHECK", "Periksa ulang lokasi sebelum mengirim.", 409);
          validateNote(result, input.note);
          const { dailyId, sessionId } = await snapshot(db, actor, s, session);
          const receipt = (
            await db.query(
              `INSERT INTO attendance_event_receipts(organization_id,employee_id,client_event_id,event_date,processing_status,payload_hash)
          VALUES($1,$2,$3,$4,'stored',$5) RETURNING id`,
              [org, employee, input.clientEventId, s.today, hash],
            )
          ).rows[0];
          const response = withAttendanceNote(
            {
              ...result,
              occurredAt: s.now.toISOString(),
              workDate: session.workDate,
              sessionName: session.name,
              startsAt: session.startsAt,
              endsAt: session.endsAt,
              pointName: point.name,
              pointSnapshot: {
                name: point.name,
                locationId: point.locationId,
                latitude: point.latitude,
                longitude: point.longitude,
                radiusMeters: point.radius,
                maxAccuracyMeters: point.maxAccuracy,
              },
              timezone: s.timezone,
              action: input.action,
            },
            input.note || null,
          );
          await db.query(
            `INSERT INTO attendance_events(event_date,organization_id,employee_id,receipt_id,daily_schedule_id,schedule_session_id,attendance_point_id,event_type,occurred_at,source,latitude,longitude,accuracy_m,distance_from_point_m,allowed_radius_m,photo_file_id,validation_status,geofence_status,photo_status,attendance_note,validation_details,created_by_user_id,assessment_version,timing_category,schedule_reference_at,schedule_offset_seconds,early_arrival_minutes,late_minutes,early_leave_minutes,late_departure_minutes,point_location_id_snapshot,point_name_snapshot,point_latitude_snapshot,point_longitude_snapshot,max_accuracy_m_snapshot,organization_timezone_snapshot,work_context)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'mobile',$10,$11,$12,$13,$14,$15,'valid',$19,'valid',$16,$17,$18,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34)`,
            [
              s.today,
              org,
              employee,
              receipt.id,
              dailyId,
              sessionId,
              point.id,
              input.action,
              s.now,
              input.latitude,
              input.longitude,
              input.accuracy,
              meters,
              point.radius,
              stored.id,
              input.note || null,
              JSON.stringify({ result: response }),
              actor.id,
              result.outsideRadius ? "outside" : "inside",
              result.timing.version,
              result.timing.category,
              result.timing.referenceAt,
              result.timing.offsetSeconds,
              result.timing.earlyArrivalMinutes,
              result.timing.lateMinutes,
              result.timing.earlyLeaveMinutes,
              result.timing.lateDepartureMinutes,
              point.locationId,
              point.name,
              point.latitude,
              point.longitude,
              point.maxAccuracy,
              s.timezone,
              session.holidayWork ? "holiday_work" : "scheduled",
            ],
          );
          const dates = [
            ...new Set([
              session.workDate,
              ...s.sessions
                .filter((item) => item.entered && !item.exited)
                .map((item) => item.workDate),
            ]),
          ];
          await refreshAttendanceSummaries(db, org, employee, dates, s.now);
          return response;
        },
      );
    } catch (error) {
      if (error.replay) return error.replay;
      throw error;
    }
  } finally {
    await form.cleanup();
  }
}
export async function handleAttendance(request, operation) {
  const requestId = getRequestId(request);
  const rejected = validateRequestOrigin(request, requestId);
  if (rejected) return rejected;
  try {
    const { user } = await requireMobileUser(request, { write: operation !== "read" });
    const actor = auth(user);
    if (
      !(await actorHasPermission(actor, "employees.read_self")) ||
      !(await actorHasPermission(actor, "assignments.read_self"))
    )
      fail("SELF_FORBIDDEN", "Anda tidak memiliki akses absensi.", 403);
    if (new URL(request.url).search) fail("INVALID_QUERY", "Parameter tidak didukung.", 400);
    if (operation !== "read") {
      const blocked = await validateMutationRequest(request, actor.id, requestId, {
        maxBytes: operation === "record" ? 6 * 1024 * 1024 : 4096,
        maxRequests: 30,
      });
      if (blocked) return blocked;
    }
    if (operation === "record") return successResponse(await record(request, actor, requestId));
    const s = await withTransaction((db) => state(db, actor));
    const holidayCapable = request.headers.get("x-sitou-attendance-version") === "2";
    if (operation === "read")
      return successResponse({
        timezone: s.timezone,
        today: s.today,
        status: s.status,
        mapProvider: s.mapProvider,
        holidayName: s.days.at(-1)?.holidayName || null,
        allowHolidayAttendance: Boolean(s.days.at(-1)?.allowHolidayAttendance),
        points: s.points,
        sessions: s.sessions
          .filter((session) => !session.holidayWork || holidayCapable)
          .map(({ rules, revisionId, shiftId, ...session }) => ({
            ...session,
            actions: user.accessMode === "read_only" ? [] : session.actions,
          })),
      });
    const { data, response } = await readJson(request, check, requestId);
    if (response) return response;
    const { session, meters, result } = validate(s, data);
    if (session.holidayWork && !holidayCapable)
      fail("APP_UPDATE_REQUIRED", "Perbarui aplikasi untuk absen pada hari libur.", 409);
    const expiry = String(s.now.getTime() + 5 * 60000);
    return successResponse({
      ...result,
      distance: Math.round(meters),
      proof: expiry + "." + sign(actor, data, session, expiry),
    });
  } catch (error) {
    if (error.status && error.code)
      return errorResponse(error.code, error.message, error.status, requestId);
    console.error("[mobile-attendance]", { requestId, code: error.code || "INTERNAL_ERROR" });
    return errorResponse("INTERNAL_ERROR", "Terjadi gangguan. Coba lagi.", 500, requestId);
  }
}
