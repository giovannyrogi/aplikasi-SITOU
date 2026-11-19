import { z } from "zod";
import pool from "@/lib/dbConfig";
import { withTransaction } from "@/lib/dbTransaction";
import { writeAudit } from "@/lib/audit";
import { actorHasPermission } from "@/lib/auth/permissions";
import { requireMobileUser } from "@/lib/auth/mobile/service";
import { requireAttendanceModule } from "@/lib/access/organizationModuleAccess";
import {
  errorResponse, getRequestId, readJson, ServiceError, successResponse,
  validateMutationRequest, validateRequestOrigin,
} from "@/lib/api/routeHelpers";
import { absoluteTime, addDays, dateValid, localDate, minute } from "@/lib/work-schedules/rules.mjs";
import {
  attendanceEventsFor, clockFor, correctionRequestsFor, findRequest, insertCorrection,
} from "./mobile-history-repository";
import { canRequestCorrection, correctionDateBounds, historySessions } from "./mobile-history-policy.mjs";
import { correctionHash, correctionOptions } from './mobile-correction-options';

const idPattern = /^[1-9]\d{0,17}$/;
const legacySubmission = z.object({
  workDate: z.string().refine(dateValid, "Tanggal kerja tidak valid."),
  eventDate: z.string().refine(dateValid, "Tanggal absen masuk tidak valid."),
  eventId: z.string().regex(idPattern, "Catatan absen masuk tidak valid."),
  date: z.string().refine(dateValid, "Pilih tanggal pulang yang valid."),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Pilih jam pulang yang valid."),
  reason: z.string().trim().min(1, "Isi alasan koreksi.").max(500, "Alasan maksimal 500 karakter."),
  requestKey: z.string().uuid("Identitas pengajuan tidak valid."),
}).strict();
const proposedTime = z.object({
  date:z.string().refine(dateValid,'Pilih tanggal yang valid.'),
  time:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/,'Pilih jam yang valid.'),
}).strict();
const currentSubmission = z.object({
  workDate:z.string().refine(dateValid,'Pilih tanggal kerja yang valid.'),
  sessionKey:z.string().min(1).max(120), version:z.string().regex(/^[a-f0-9]{64}$/),
  part:z.enum(['arrival','departure','both']),
  arrival:proposedTime.nullable(),departure:proposedTime.nullable(),
  reason:z.string().trim().min(1,'Isi alasan koreksi.').max(500,'Alasan maksimal 500 karakter.'),
  requestKey:z.string().uuid(),
}).strict().superRefine((value,ctx) => {
  for (const key of ['arrival','departure']) {
    if ((value.part === key || value.part === 'both') !== Boolean(value[key]))
      ctx.addIssue({code:'custom',path:[key],message:'Lengkapi jam yang ingin dikoreksi.'});
  }
});
const submission={safeParse(value){
  return (value && typeof value === 'object' && ('sessionKey' in value || 'part' in value)
    ? currentSubmission : legacySubmission).safeParse(value);
}};

function actorFor(user) {
  return {
    id: user.id, organization_id: user.organizationId, role_code: user.role,
    ids: [user.organizationId, user.employeeId],
  };
}

function fieldError(field, message) {
  throw new ServiceError("VALIDATION_ERROR", message, 422, { [field]: message });
}

function checkoutInstant(input, timezone) {
  try {
    return new Date(absoluteTime(input.date, minute(input.time), timezone));
  } catch {
    fieldError("time", "Jam pulang tidak berlaku pada tanggal ini.");
  }
}

function clockText(value, zone) {
  return value
    ? new Intl.DateTimeFormat("en-GB", { timeZone: zone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(value))
    : null;
}

function eventDto(event, clock) {
  if (!event) return null;
  const zone = event.timezone || clock.timezone;
  return {
    date: localDate(event.occurredAt, zone), time: clockText(event.occurredAt, zone), point: event.point,
    timing: event.timing, earlyArrival: event.earlyArrival, late: event.late,
    earlyLeave: event.earlyLeave, lateDeparture: event.lateDeparture,
  };
}

function historyDto(entry, clock, readOnly, modern) {
  const { arrival, departure, evidence } = entry;
  const timezone = evidence.timezone || clock.timezone;
  const bounds = arrival
    ? correctionDateBounds(entry, arrival.timezone || clock.timezone, clock.today) : null;
  return {
    workDate: entry.workDate, sessionKey:entry.sessionKey, arrival: eventDto(arrival, clock), departure: eventDto(departure, clock),
    eventId: arrival?.id ?? null, eventDate: arrival?.eventDate ?? null,
    scheduleName: evidence.shiftName?.replace(/ — sesi \d+$/, "") ?? null,
    startsAt: clockText(evidence.startsAt, timezone), endsAt: clockText(evidence.endsAt, timezone),
    context: evidence.context, correctionStatus: evidence.correctionStatus ?? null,
    holidayName: evidence.holidayName || null,
    canCorrect: !readOnly && canRequestCorrection(entry, clock) && (modern ||
      Boolean(arrival && !departure && !arrival.correctionStatus && entry.workDate < clock.today)),
    firstCorrectionDate: bounds?.min ?? null, lastCorrectionDate: bounds?.max ?? null,
  };
}

function correctionDto(row) {
  const mark = (at) => at ? {date:localDate(new Date(at),row.timezone),time:clockText(at,row.timezone)} : null;
  return {
    id: row.id, workDate: row.workDate, status: row.status, reason: row.reason, part:row.part,
    arrival:mark(row.requestedArrival),departure:mark(row.requestedAt),
    originalArrival:mark(row.basis?.arrival?.occurredAt),originalDeparture:mark(row.basis?.departure?.occurredAt),
    date: row.requestedAt ? localDate(row.requestedAt, row.timezone) : null, time: clockText(row.requestedAt, row.timezone),
    createdAt: row.createdAt, reviewNote: row.reviewNote,
  };
}

async function readOptions(query, actor, clock, readOnly) {
  if ([...query.keys()].some((key) => key !== 'workDate') || query.getAll('workDate').length > 1)
    fieldError('workDate','Tanggal kerja tidak valid.');
  const workDate=query.get('workDate') ?? clock.today;
  if (!dateValid(workDate)) fieldError('workDate','Pilih tanggal kerja yang valid.');
  const sessions=await correctionOptions(pool,actor,clock,workDate);
  return {today:clock.today, firstDate:clock.firstDate, workDate, readOnly,
    sessions:sessions.map((s) => ({
      sessionKey:s.sessionKey,version:s.version,context:s.context,name:s.name,
      startsAt:clockText(s.startsAt ? new Date(s.startsAt) : null,clock.timezone),
      endsAt:clockText(s.endsAt ? new Date(s.endsAt) : null,clock.timezone),
      arrival:eventDto(s.entry?.arrival,clock),departure:eventDto(s.entry?.departure,clock),
      endDate:s.endsAt ? localDate(new Date(s.endsAt),clock.timezone) : workDate,
      firstDate:s.firstDate,lastDate:s.lastDate,available:s.available && !readOnly,pending:s.pending,
      unavailableReason:readOnly ? 'Akun Anda hanya dapat melihat data.' : s.pending ?
        'Koreksi jam kerja ini sedang ditinjau HRD.' : !s.available ?
        'Koreksi dapat diajukan setelah jam kerja selesai.' : null,
    }))};
}

async function readHistory(query, actor, clock, readOnly, modern) {
  if ([...query.keys()].some((key) => key !== "month") || query.getAll("month").length > 1)
    fieldError("month", "Parameter riwayat tidak valid.");
  const month = query.get("month") ?? clock.today.slice(0, 7);
  const from = month + "-01";
  const firstMonth = clock.firstDate.slice(0, 7);
  if (!dateValid(from) || month < firstMonth || month > clock.today.slice(0, 7))
    fieldError("month", "Pilih bulan dalam masa kerja Anda.");
  const until = addDays(from, 32).slice(0, 7) + "-01";
  const events = await attendanceEventsFor(pool, actor, from, until);
  return {
    today: clock.today, firstMonth, month,
    records: historySessions(events).map((entry) => historyDto(entry, clock, readOnly, modern)),
  };
}

async function readCorrections(query, actor, modern) {
  if ([...query.keys()].some((key) => key !== "cursor") || query.getAll("cursor").length > 1)
    fieldError("cursor", "Parameter pengajuan tidak valid.");
  const cursor = query.get("cursor");
  const before = cursor == null ? null : Buffer.from(cursor.slice(0, 32), "base64url").toString();
  if (cursor != null && (!idPattern.test(before) || Buffer.from(before).toString("base64url") !== cursor))
    fieldError("cursor", "Muat ulang daftar pengajuan.");
  const pageSize = 30;
  const rows = await correctionRequestsFor(pool, actor, before, pageSize + 1, modern);
  const page = rows.slice(0, pageSize);
  return {
    requests: page.map(correctionDto),
    nextCursor: rows.length > pageSize ? Buffer.from(page.at(-1).id).toString("base64url") : null,
  };
}

async function submitCorrection(request, actor, input, requestId) {
  return withTransaction(async (db) => {
    await db.query("SELECT id FROM organizations WHERE id=$1 FOR NO KEY UPDATE", [actor.organization_id]);
    await db.query("SELECT id FROM employees WHERE organization_id=$1 AND id=$2 FOR NO KEY UPDATE", actor.ids);
    await requireAttendanceModule(db, actor.organization_id);
    const { user } = await requireMobileUser(request, { write: true, database: db });
    if (actorFor(user).ids.some((id, index) => String(id) !== String(actor.ids[index])))
      throw new ServiceError("UNAUTHENTICATED", "Sesi berakhir. Silakan masuk kembali.", 401);

    const previous = await findRequest(db, actor, input.requestKey);
    const payloadHash=correctionHash(input);
    if (previous) {
      const same = previous.payloadHash ? previous.payloadHash === payloadHash : previous.workDate === input.workDate && previous.eventDate === input.eventDate &&
        previous.eventId === input.eventId && previous.reason === input.reason &&
        localDate(previous.requestedAt, previous.timezone) === input.date &&
        clockText(previous.requestedAt, previous.timezone) === input.time;
      if (!same) throw new ServiceError("CORRECTION_CONFLICT", "Isian pengajuan berubah. Muat ulang riwayat.", 409);
      return correctionDto(previous);
    }

    const clock = await clockFor(db, actor);
    if (!clock) throw new ServiceError("EMPLOYEE_UNAVAILABLE", "Profil Pegawai tidak tersedia.", 403);
    if (input.workDate < clock.firstDate || input.workDate > clock.today)
      fieldError("workDate", "Tanggal kerja belum dapat dikoreksi.");
    const sessions=await correctionOptions(db,actor,clock,input.workDate);
    const selected=sessions.find((s) => input.sessionKey ? s.sessionKey === input.sessionKey :
      s.entry?.arrival?.id === input.eventId && s.entry.arrival.eventDate === input.eventDate);
    if (!selected) throw new ServiceError('ATTENDANCE_NOT_FOUND','Jam kerja tidak ditemukan. Pilih tanggal lain atau hubungi HRD.',404);
    if (!selected.available) throw new ServiceError('CORRECTION_UNAVAILABLE',selected.pending ?
      'Koreksi jam kerja ini sedang ditinjau HRD.' : 'Koreksi dapat diajukan setelah jam kerja selesai.',409);
    if (!input.sessionKey && (!selected.entry?.arrival || selected.entry.departure || input.workDate >= clock.today))
      throw new ServiceError('CORRECTION_UNAVAILABLE','Absen ini sudah berubah. Muat ulang riwayat atau perbarui SITOU.',409);
    if (input.version && input.version !== selected.version)
      throw new ServiceError('CORRECTION_CONFLICT','Data absensi berubah. Periksa kembali jam kerja Anda.',409);
    const zone=clock.timezone;
    const normalized=input.sessionKey ? input : {...input,part:'departure',arrival:null,departure:{date:input.date,time:input.time}};
    const proposed = {};
    for (const key of ['arrival','departure']) {
      const value=normalized[key];
      if (!value) { proposed[key]=null; continue; }
      if (value.date < selected.firstDate || value.date > selected.lastDate)
        fieldError(key,'Pilih tanggal yang sesuai dengan jam kerja ini.');
      proposed[key]=checkoutInstant(value,zone);
      if (proposed[key] > clock.now) fieldError(key,'Jam absen tidak boleh melewati waktu sekarang.');
    }
    const arrival=proposed.arrival ?? selected.entry?.arrival?.occurredAt;
    const departure=proposed.departure ?? selected.entry?.departure?.occurredAt;
    if (!arrival && normalized.part === 'departure') fieldError('part','Absen masuk belum ada. Pilih Masuk dan pulang.');
    if (!departure && normalized.part === 'arrival') fieldError('part','Absen pulang belum ada. Pilih Masuk dan pulang.');
    if (arrival && departure && new Date(departure) <= new Date(arrival))
      fieldError(normalized.part === 'arrival' ? 'arrival' : 'departure','Jam pulang harus setelah jam masuk.');
    if (['arrival','departure'].every((key) => !proposed[key] ||
        (selected.entry?.[key] && localDate(proposed[key],zone) === localDate(selected.entry[key].occurredAt,zone) &&
          clockText(proposed[key],zone) === clockText(selected.entry[key].occurredAt,zone))))
      fieldError('part','Jam yang diajukan masih sama. Ubah jam yang ingin dikoreksi.');
    const row = await insertCorrection(db, actor, selected, normalized, proposed.arrival,proposed.departure, zone,payloadHash);
    if (!row) throw new ServiceError("CORRECTION_EXISTS", "Koreksi untuk absen ini sudah diajukan.", 409);
    await writeAudit(db, {
      organizationId: actor.organization_id, actorUserId: actor.id, action: "attendance.correction.request",
      entityType: "attendance_correction_request", entityId: row.id,
      afterData: { workDate: input.workDate, part:normalized.part, sessionKey:selected.sessionKey,status: row.status }, requestId,
    });
    return correctionDto(row);
  });
}

export async function handleMobileHistory(request, operation) {
  const requestId = getRequestId(request);
  const rejected = validateRequestOrigin(request, requestId);
  if (rejected) return rejected;
  try {
    const write = operation === "submit";
    const { user } = await requireMobileUser(request, { write });
    const actor = actorFor(user);
    if (!(await actorHasPermission(actor, "employees.read_self")) ||
        !(await actorHasPermission(actor, "assignments.read_self")))
      throw new ServiceError("SELF_FORBIDDEN", "Anda tidak memiliki akses absensi.", 403);
    await requireAttendanceModule(pool, actor.organization_id);
    const query = new URL(request.url).searchParams;
    const modern=request.headers.get('x-sitou-corrections-version') === '2';
    if (operation === "corrections") return successResponse(await readCorrections(query, actor, modern));
    if (write) {
      if (query.size) fieldError("form", "Parameter pengajuan tidak didukung.");
      const blocked = await validateMutationRequest(request, actor.id, requestId, { maxBytes: 4096, maxRequests: 15 });
      if (blocked) return blocked;
      const { data, response } = await readJson(request, submission, requestId);
      if (response) return response;
      return successResponse(await submitCorrection(request, actor, data, requestId));
    }
    const clock = await clockFor(pool, actor);
    if (!clock) throw new ServiceError("EMPLOYEE_UNAVAILABLE", "Profil Pegawai tidak tersedia.", 403);
    if (operation === 'options') return successResponse(await readOptions(query,actor,clock,user.accessMode === 'read_only'));
    return successResponse(await readHistory(query, actor, clock, user.accessMode === "read_only",modern));
  } catch (error) {
    if (error.status && error.code)
      return errorResponse(error.code, error.message, error.status, requestId, error.fieldErrors);
    console.error("[mobile-attendance-history]", { requestId, code: error.code || "INTERNAL_ERROR" });
    return errorResponse("INTERNAL_ERROR", "Terjadi gangguan. Coba lagi.", 500, requestId);
  }
}
