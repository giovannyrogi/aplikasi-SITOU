import { createHash } from "node:crypto";
import pool from "@/lib/dbConfig";
import { withTransaction } from "@/lib/dbTransaction";
import { writeAudit } from "@/lib/audit";
import { ServiceError } from "@/lib/api/routeHelpers";
import { getActorLocationScope } from "@/lib/auth/permissions";
import * as repo from "./repository";
import { validateCalendarSources } from "@/lib/holiday-catalogs/service";
import { adjustmentOptions } from "./adjustmentOptions";
import { patternAt, patternDefinition } from "./definitionRevisions.mjs";
import {
  fail,
  addDays,
  dayDiff,
  dayNumber,
  makeSessions,
  assertNoOverlap,
  validateRange,
} from "./rules.mjs";
const canonical = (x) =>
  Array.isArray(x)
    ? x.map(canonical)
    : x && typeof x === "object"
      ? Object.fromEntries(
          Object.keys(x)
            .sort()
            .map((k) => [k, canonical(x[k])]),
        )
      : x;
export const HASH = (x) =>
  createHash("sha256")
    .update(JSON.stringify(canonical(x)))
    .digest("hex");
const tables = { shifts: "work_shifts", patterns: "shift_patterns", calendars: "work_calendars" };
const keys = { shifts: "work-shifts", patterns: "work-shifts", calendars: "work-calendars" };
export const checkVersion = (row, v) => {
  if (!Number.isInteger(v) || row?.version !== v)
    throw new ServiceError("VERSION_CONFLICT", "Data berubah. Muat ulang.", 409, {
      version: "Muat ulang data.",
    });
};
function dateAfter(date, today, field = "from") {
  if (date < today) fail("Tanggal tidak boleh sebelum hari ini.", field);
}
async function audit(db, actor, org, action, id, data, requestId) {
  await writeAudit(db, {
    organizationId: org,
    actorUserId: actor.id,
    action: "work_schedule." + action,
    entityType: "work_schedule",
    entityId: id,
    afterData: data,
    requestId,
  });
}
export async function mutation(actor, input, key, op, requestId, action) {
  return withTransaction(async (db) => {
    await repo.requireScheduleAccess(db, actor, input.organizationId, key, true);
    const org = await repo.organization(db, input.organizationId, true);
    let receipt;
    if (input.requestKey) {
      receipt = (
        await db.query(
          "SELECT payload_hash,result FROM work_schedule_requests WHERE organization_id=$1 AND actor_user_id=$2 AND operation=$3 AND request_key=$4",
          [input.organizationId, actor.id, op, input.requestKey],
        )
      ).rows[0];
      if (receipt) {
        if (receipt.payload_hash !== HASH(input))
          throw new ServiceError(
            "IDEMPOTENCY_CONFLICT",
            "Permintaan yang sama memiliki data berbeda.",
            409,
          );
        const masterTable =
          op === "template.save"
            ? "shift_patterns"
            : op === "shift-group.save"
              ? "work_schedule_groups"
              : null;
        const masterMissing =
          masterTable &&
          !(
            await db.query(`SELECT 1 FROM ${masterTable} WHERE organization_id=$1 AND id=$2`, [
              input.organizationId,
              receipt.result.id,
            ])
          ).rowCount;
        if (receipt.result.deleted || masterMissing)
          throw new ServiceError(
            "ALREADY_DELETED",
            "Data sudah dihapus. Daftar akan diperbarui.",
            409,
          );
        return receipt.result;
      }
    }
    const result = await action(db, org);
    if (input.requestKey)
      await db.query(
        "INSERT INTO work_schedule_requests(organization_id,actor_user_id,operation,request_key,payload_hash,result) VALUES($1,$2,$3,$4,$5,$6)",
        [input.organizationId, actor.id, op, input.requestKey, HASH(input), JSON.stringify(result)],
      );
    await audit(
      db,
      actor,
      input.organizationId,
      op,
      result.id || input.employeeId || input.employeeIds?.[0] || input.organizationId,
      { ...input, result },
      requestId,
    );
    return result;
  });
}
export function shiftAt(ctx, id, date, active = false) {
  const s = ctx.shifts.find((x) => x.id === String(id));
  if (!s || (active && !s.is_active)) fail("Shift tidak tersedia.", "shiftIds");
  const r = ctx.revisions.findLast(
    (x) =>
      x.shift_id === s.id &&
      (x.effective_from === "-infinity" || x.effective_from <= date) &&
      (!x.effective_until || x.effective_until >= date),
  );
  if (!r) fail("Aturan shift belum tersedia pada tanggal tersebut.", "shiftIds");
  return { ...s, rules: r.rules, revision_id: r.id };
}
/** New choices require working hours; existing off-day history stays readable. */
export function workingShiftAt(ctx, id, date) {
  const shift = shiftAt(ctx, id, date, true);
  if (shift.rules.type === "off")
    fail(
      "Pilih jam kerja. Jadwal libur tidak dapat digunakan untuk perubahan jam kerja.",
      "shiftIds",
    );
  return shift;
}
function patternDaysValid(p) {
  if (p.patternType === "weekly" && p.cycleDays !== 7)
    fail("Pola mingguan harus tujuh hari.", "cycleDays");
  if (
    p.days.length !== p.cycleDays ||
    new Set(p.days.map((x) => x.day)).size !== p.cycleDays ||
    p.days.some((x) => x.day > p.cycleDays)
  )
    fail("Isi setiap hari pada pola.", "days");
  if (p.holidayPolicy === "calendar" && !p.calendarId) fail("Pilih kalender libur.", "calendarId");
}
function checkPatternTimes(ctx, p, date, zone, active = false) {
  const origin =
    p.pattern_type === "weekly"
      ? addDays(date, -((new Date(date + "T12:00:00Z").getUTCDay() + 6) % 7))
      : date;
  let all = [];
  for (let i = -1; i <= p.cycle_days; i++) {
    const day = addDays(origin, i);
    const d = dayNumber(day, p, origin);
    const ids = p.days.find((x) => x.day === d)?.shiftIds || [];
    all.push(
      ...makeSessions(
        day,
        ids.map((id) => shiftAt(ctx, id, day, active)),
        zone,
      ),
    );
  }
  assertNoOverlap(all);
}
/** One immutable baseline and monotonically dated revisions; caller holds the organization lock. */
async function rememberDefinition(db, actor, input, prior, next, org) {
  const latest = (
    await db.query(
      "SELECT effective_from::text FROM work_schedule_definition_revisions WHERE organization_id=$1 AND pattern_id=$2 ORDER BY effective_from DESC LIMIT 1",
      [input.organizationId, input.id],
    )
  ).rows[0];
  if (!input.effectiveFrom || !input.reason)
    fail("Pilih tanggal mulai berlaku dan isi alasan perubahan jadwal.", "effectiveFrom");
  dateAfter(input.effectiveFrom, addDays(org.today, 1), "effectiveFrom");
  if (latest && input.effectiveFrom <= latest.effective_from)
    fail("Pilih tanggal setelah perubahan jadwal terakhir.", "effectiveFrom");
  const insert = (date, definition, reason, creator) =>
    db.query(
      `INSERT INTO work_schedule_definition_revisions(organization_id,pattern_id,effective_from,pattern_type,cycle_days,calendar_id,holiday_policy,days,reason,created_by_user_id,allow_holiday_attendance)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        input.organizationId,
        input.id,
        date,
        definition.pattern_type,
        definition.cycle_days,
        definition.calendar_id,
        definition.holiday_policy,
        JSON.stringify(definition.days),
        reason,
        creator,
        definition.allow_holiday_attendance ?? false,
      ],
    );
  if (!latest)
    await insert(
      "-infinity",
      patternDefinition(prior),
      "Pengaturan sebelum perubahan jadwal",
      null,
    );
  await insert(input.effectiveFrom, next, input.reason, actor.id);
}

/** Validate future boundaries/exceptions without rewriting any operational evidence. */
async function checkDefinitionImpact(db, actor, input, org) {
  const assignments = (
    await db.query(
      `SELECT employee_id::text,effective_from::text,effective_until::text FROM shift_assignments
     WHERE organization_id=$1 AND shift_pattern_id=$2 AND employee_id IS NOT NULL AND cancelled_at IS NULL
     AND (effective_until IS NULL OR effective_until >= $3) ORDER BY employee_id`,
      [input.organizationId, input.id, input.effectiveFrom],
    )
  ).rows;
  const ctx = await repo.context(db, input.organizationId);
  for (const a of assignments) {
    await repo.employee(db, actor, input.organizationId, a.employee_id);
    const start = a.effective_from > input.effectiveFrom ? a.effective_from : input.effectiveFrom;
    const protectedDay = (
      await db.query(
        `SELECT work_date::text FROM attendance_daily_summaries WHERE organization_id=$1 AND employee_id=$2
       AND work_date >= $3 AND ($4::date IS NULL OR work_date <= $4)
       UNION ALL SELECT d.work_date::text FROM employee_daily_schedules d WHERE d.organization_id=$1 AND d.employee_id=$2
       AND d.work_date >= $3 AND ($4::date IS NULL OR d.work_date <= $4)
       AND EXISTS(SELECT 1 FROM attendance_events e WHERE e.organization_id=d.organization_id AND e.daily_schedule_id=d.id) LIMIT 1`,
        [input.organizationId, a.employee_id, start, a.effective_until],
      )
    ).rows[0];
    if (protectedDay)
      fail(
        `Jadwal pada ${protectedDay.work_date} sudah digunakan absensi atau rekap. Pilih tanggal berlaku setelah periode tersebut.`,
        "effectiveFrom",
        "SCHEDULE_ALREADY_USED",
      );
    const points = new Set([start]);
    if (a.effective_until) points.add(a.effective_until);
    const exceptions = (
      await db.query(
        `SELECT work_date::text FROM work_schedule_exceptions WHERE organization_id=$1 AND employee_id=$2
       AND work_date >= $3 AND ($4::date IS NULL OR work_date <= $4)`,
        [input.organizationId, a.employee_id, start, a.effective_until],
      )
    ).rows;
    for (const e of exceptions) points.add(e.work_date);
    for (const r of ctx.revisions)
      if (
        r.effective_from >= start &&
        (!a.effective_until || r.effective_from <= a.effective_until)
      )
        points.add(r.effective_from);
    for (const date of points) {
      const p = patternAt(ctx, input.id, date);
      const end = addDays(date, p.cycle_days + 1);
      await checkBoundary(db, input.organizationId, a.employee_id, date, end, ctx, org.timezone);
    }
  }
}
/** Master memakai ID dan nama; API tidak menerima field kode. */
export async function listMasters(
  actor,
  org,
  kind,
  { q = "", page = 1, pageSize = 20, status = "all", standalone = false } = {},
) {
  await repo.requireScheduleAccess(pool, actor, org, keys[kind]);
  await repo.organization(pool, org);
  const args = [
    org,
    "%" + q + "%",
    pageSize,
    (page - 1) * pageSize,
    status === "active" ? true : status === "inactive" ? false : null,
  ];
  const groupFilter =
    kind === "patterns" && standalone
      ? " AND NOT EXISTS(SELECT 1 FROM work_schedule_group_items gi WHERE gi.organization_id=shift_patterns.organization_id AND gi.pattern_id=shift_patterns.id)"
      : "";
  const r = await pool.query(
    `SELECT *,id::text,count(*) OVER()::int AS total FROM ${tables[kind]} WHERE organization_id=$1 AND name ILIKE $2 AND ($5::boolean IS NULL OR is_active=$5)${groupFilter} ORDER BY lower(name),${tables[kind]}.id LIMIT $3 OFFSET $4`,
    args,
  );
  const data = r.rows.map(({ total, ...x }) => x);
  if (kind === "shifts") {
    const ctx = await repo.context(pool, org);
    for (const row of data) row.revisions = ctx.revisions.filter((x) => x.shift_id === row.id);
  }
  if (kind === "patterns") {
    const ctx = await repo.context(pool, org);
    for (const row of data) row.days = ctx.patterns.find((x) => x.id === row.id).days;
  }
  if (kind === "calendars")
    for (const row of data)
      row.days = (
        await pool.query(
          `SELECT w.holiday_date::text AS date,w.name,w.catalog_day_id::text AS "catalogDayId",d.category,c.year AS "catalogYear",c.revision AS "catalogRevision" FROM work_calendar_days w LEFT JOIN holiday_catalog_days d ON d.id=w.catalog_day_id LEFT JOIN holiday_catalogs c ON c.id=d.catalog_id WHERE w.organization_id=$1 AND w.calendar_id=$2 ORDER BY w.holiday_date`,
          [org, row.id],
        )
      ).rows;
  const total =
    r.rows[0]?.total ??
    (
      await pool.query(
        `SELECT count(*)::int n FROM ${tables[kind]} WHERE organization_id=$1 AND name ILIKE $2 AND ($3::boolean IS NULL OR is_active=$3)${groupFilter}`,
        [org, args[1], args[4]],
      )
    ).rows[0].n;
  return { data, total, page, pageSize };
}
export async function saveMaster(actor, input, kind, requestId) {
  return mutation(actor, input, keys[kind], kind + ".save", requestId, (db, org) =>
    saveMasterInTransaction(db, actor, input, kind, org),
  );
}
// Form gabungan menyimpan sesi dan pola dengan transaksi/lock yang sama.
export async function saveMasterInTransaction(
  db,
  actor,
  input,
  kind,
  org,
  { groupWrite = false } = {},
) {
  if (
    !groupWrite &&
    (kind === "patterns" || kind === "shifts") &&
    (await db.query("SELECT to_regclass('public.work_schedule_group_items') AS relation")).rows[0]
      .relation
  ) {
    const owned = await db.query(
      "SELECT 1 FROM work_schedule_group_items WHERE organization_id=$1 AND (pattern_id=$2 OR shift_id=ANY($3::bigint[])) LIMIT 1",
      [
        input.organizationId,
        kind === "patterns" ? input.id || null : null,
        kind === "shifts"
          ? [input.id].filter(Boolean)
          : (input.days || []).flatMap((day) => day.shiftIds || []),
      ],
    );
    if (owned.rows.length)
      fail(
        "Pilihan shift ini dikelola melalui Jadwal Kerja. Buka kelompok shift untuk mengubahnya.",
        "name",
      );
  }
  const table = tables[kind];
  let old;
  if (input.id) {
    old = (
      await db.query(`SELECT * FROM ${table} WHERE organization_id=$1 AND id=$2 FOR UPDATE`, [
        input.organizationId,
        input.id,
      ])
    ).rows[0];
    if (!old) throw new ServiceError("NOT_FOUND", "Data tidak ditemukan.", 404);
    checkVersion(old, input.version);
  }
  let id = input.id;
  if (kind === "shifts") {
    if (!old && input.rules.type === "field")
      fail("Pengaturan kerja lapangan belum tersedia.", "rules.type");
    const ctx = await repo.context(db, input.organizationId);
    if (old) {
      const current = ctx.revisions.findLast((x) => x.shift_id === id && !x.effective_until);
      const changed = HASH(current.rules) !== HASH(input.rules);
      if (changed) {
        if (input.rules.type === "field")
          fail("Pengaturan kerja lapangan belum tersedia.", "rules.type");
        const used = (
          await db.query(
            "SELECT 1 FROM shift_pattern_days WHERE organization_id=$1 AND shift_id=$2 UNION ALL SELECT 1 FROM work_schedule_sessions WHERE organization_id=$1 AND shift_id=$2 LIMIT 1",
            [input.organizationId, id],
          )
        ).rows.length;
        if (!input.effectiveFrom || !input.reason)
          fail("Isi tanggal berlaku dan alasan revisi.", "effectiveFrom");
        dateAfter(input.effectiveFrom, used ? addDays(org.today, 1) : org.today, "effectiveFrom");
        if (current.effective_from !== "-infinity" && input.effectiveFrom <= current.effective_from)
          fail("Tanggal revisi harus setelah revisi terakhir.", "effectiveFrom");
        await db.query(
          "UPDATE work_shift_revisions SET effective_until=$3::date-1 WHERE organization_id=$1 AND id=$2",
          [input.organizationId, current.id, input.effectiveFrom],
        );
        await db.query(
          "INSERT INTO work_shift_revisions(organization_id,shift_id,effective_from,rules,reason,created_by_user_id) VALUES($1,$2,$3,$4,$5,$6)",
          [input.organizationId, id, input.effectiveFrom, input.rules, input.reason, actor.id],
        );
        const updated = await repo.context(db, input.organizationId);
        for (const p of updated.patterns.filter((x) => x.days.some((d) => d.shiftIds.includes(id))))
          checkPatternTimes(updated, p, input.effectiveFrom, org.timezone);
      }
      await db.query(
        "UPDATE work_shifts SET name=$3,is_active=$4,version=version+1,updated_at=now() WHERE organization_id=$1 AND id=$2",
        [input.organizationId, id, input.name, input.isActive],
      );
    } else {
      id = (
        await db.query(
          `INSERT INTO work_shifts(organization_id,name,shift_type,start_time,end_time,is_active) VALUES($1,$2,$3,$4,$5,$6) RETURNING id::text`,
          [
            input.organizationId,
            input.name,
            input.rules.type,
            input.rules.startTime,
            input.rules.endTime,
            input.isActive,
          ],
        )
      ).rows[0].id;
      await db.query(
        "INSERT INTO work_shift_revisions(organization_id,shift_id,effective_from,rules,reason,created_by_user_id) VALUES($1,$2,'-infinity',$3,'Pembuatan shift', $4)",
        [input.organizationId, id, input.rules, actor.id],
      );
    }
  } else if (kind === "calendars") {
    if (new Set(input.days.map((d) => d.date)).size !== input.days.length)
      fail("Tanggal libur tidak boleh berulang.", "days");
    const previous = old
      ? (
          await db.query(
            'SELECT holiday_date::text AS date,name,catalog_day_id::text AS "catalogDayId" FROM work_calendar_days WHERE organization_id=$1 AND calendar_id=$2',
            [input.organizationId, id],
          )
        ).rows
      : [];
    input.days = await validateCalendarSources(db, input.days, previous);
    if (old) {
      const prior = previous;
      if (
        prior.some(
          (d) =>
            d.date < org.today &&
            !input.days.some(
              (n) => n.date === d.date && n.name === d.name && n.catalogDayId === d.catalogDayId,
            ),
        ) ||
        input.days.some(
          (d) =>
            d.date < org.today &&
            !prior.some(
              (n) => n.date === d.date && n.name === d.name && n.catalogDayId === d.catalogDayId,
            ),
        )
      )
        fail("Hari libur yang sudah lewat tidak boleh diubah.", "days");
      await db.query(
        "UPDATE work_calendars SET name=$3,is_active=$4,version=version+1,updated_at=now() WHERE organization_id=$1 AND id=$2",
        [input.organizationId, id, input.name, input.isActive],
      );
    } else {
      if (input.days.some((d) => d.date < org.today))
        fail("Tanggal libur tidak boleh sebelum hari ini.", "days");
      id = (
        await db.query(
          "INSERT INTO work_calendars(organization_id,name,is_active) VALUES($1,$2,$3) RETURNING id::text",
          [input.organizationId, input.name, input.isActive],
        )
      ).rows[0].id;
    }
    await db.query("DELETE FROM work_calendar_days WHERE organization_id=$1 AND calendar_id=$2", [
      input.organizationId,
      id,
    ]);
    for (const d of input.days)
      await db.query(
        "INSERT INTO work_calendar_days(organization_id,calendar_id,holiday_date,name,catalog_day_id) VALUES($1,$2,$3,$4,$5)",
        [input.organizationId, id, d.date, d.name, d.catalogDayId],
      );
  } else {
    patternDaysValid(input);
    if (
      input.calendarId &&
      !(old && String(old.calendar_id) === String(input.calendarId)) &&
      !(
        await db.query(
          "SELECT 1 FROM work_calendars WHERE organization_id=$1 AND id=$2 AND is_active",
          [input.organizationId, input.calendarId],
        )
      ).rows[0]
    )
      fail("Kalender tidak tersedia.", "calendarId");
    const ctx = await repo.context(db, input.organizationId);
    const allowHoliday = input.allowHolidayAttendance ?? old?.allow_holiday_attendance ?? false;
    const definition = {
      pattern_type: input.patternType,
      cycle_days: input.cycleDays,
      days: input.days,
    };

    let used = false;
    if (old) {
      used = Boolean(
        (
          await db.query(
            "SELECT 1 FROM shift_assignments WHERE organization_id=$1 AND shift_pattern_id=$2 LIMIT 1",
            [input.organizationId, id],
          )
        ).rows[0],
      );
      const prior = ctx.patterns.find((x) => x.id === id);
      const next = {
        ...definition,
        calendar_id: input.calendarId,
        holiday_policy: input.holidayPolicy,
        allow_holiday_attendance: allowHoliday,
      };
      const changed = HASH(patternDefinition(prior)) !== HASH(next);
      used ||= ctx.definitionRevisions.some((r) => r.pattern_id === id);
      if (used && changed) await rememberDefinition(db, actor, input, prior, next, org);
      // Metadata-only writes must not duplicate immutable revisions.
      input = { ...input, definitionChanged: used && changed };
      await db.query(
        "UPDATE shift_patterns SET name=$3,is_active=$4,version=version+1,updated_at=now() WHERE organization_id=$1 AND id=$2",
        [input.organizationId, id, input.name, input.isActive],
      );
    } else
      id = (
        await db.query(
          "INSERT INTO shift_patterns(organization_id,name,is_active,pattern_type,cycle_days,calendar_id,holiday_policy,allow_holiday_attendance) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id::text",
          [
            input.organizationId,
            input.name,
            input.isActive,
            input.patternType,
            input.cycleDays,
            input.calendarId,
            input.holidayPolicy,
            allowHoliday,
          ],
        )
      ).rows[0].id;
    if (!used || input.definitionChanged) {
      checkPatternTimes(
        ctx,
        definition,
        input.definitionChanged ? input.effectiveFrom : org.today,
        org.timezone,
        true,
      );
      for (const revision of ctx.revisions.filter(
        (r) => r.effective_from !== "-infinity" && r.effective_from > org.today,
      ))
        checkPatternTimes(ctx, definition, revision.effective_from, org.timezone, true);
      await db.query(
        "UPDATE shift_patterns SET pattern_type=$3,cycle_days=$4,calendar_id=$5,holiday_policy=$6,allow_holiday_attendance=$7 WHERE organization_id=$1 AND id=$2",
        [
          input.organizationId,
          id,
          input.patternType,
          input.cycleDays,
          input.calendarId,
          input.holidayPolicy,
          allowHoliday,
        ],
      );
      await db.query(
        "DELETE FROM shift_pattern_days WHERE organization_id=$1 AND shift_pattern_id=$2",
        [input.organizationId, id],
      );
      for (const d of input.days)
        for (const [i, s] of (d.shiftIds.length ? d.shiftIds : [null]).entries())
          await db.query(
            "INSERT INTO shift_pattern_days(organization_id,shift_pattern_id,day_no,session_no,shift_id) VALUES($1,$2,$3,$4,$5)",
            [input.organizationId, id, d.day, i + 1, s],
          );
      if (input.definitionChanged) await checkDefinitionImpact(db, actor, input, org);
    }
  }
  return { id };
}
export async function listTemplates(actor, org, filters) {
  const result = await listMasters(actor, org, "patterns", filters);
  const ctx = await repo.context(pool, org);
  const info = await repo.organization(pool, org);
  const calendarNames = (
    await pool.query("SELECT id::text,name FROM work_calendars WHERE organization_id=$1", [org])
  ).rows;
  for (const row of result.data) {
    row.calendar_name = calendarNames.find((c) => c.id === String(row.calendar_id))?.name || null;
    row.used = Boolean(
      (
        await pool.query(
          "SELECT 1 FROM shift_assignments WHERE organization_id=$1 AND shift_pattern_id=$2 LIMIT 1",
          [org, row.id],
        )
      ).rows[0],
    );
    row.latestEffectiveFrom =
      ctx.definitionRevisions.filter((r) => r.pattern_id === row.id).at(-1)?.effective_from || null;
    row.days = row.days.map((day) => ({
      day: day.day,
      sessions: day.shiftIds.map((shiftId) => {
        const shift = shiftAt(ctx, shiftId, info.today);
        return { shiftId, name: shift.name, rules: shift.rules };
      }),
    }));
  }
  return result;
}
export async function saveTemplate(actor, input, requestId) {
  return mutation(actor, input, "work-shifts", "template.save", requestId, async (db, org) => {
    const ctx = await repo.context(db, input.organizationId);
    const created = new Map();
    const days = [];
    // Batas yang sama dengan pola diperiksa sebelum membuat sesi pertama.
    patternDaysValid({ ...input, days: input.days.map((d) => ({ day: d.day, shiftIds: [] })) });
    for (const day of input.days) {
      const shiftIds = [];
      for (const [sessionIndex, session] of day.sessions.entries()) {
        if (session.shiftId) {
          shiftAt(ctx, session.shiftId, org.today);
          shiftIds.push(session.shiftId);
          continue;
        }
        if (session.rules.type === "field")
          fail("Pengaturan kerja lapangan belum tersedia.", "days");
        const priorId = ctx.patterns
          .find((p) => p.id === input.id)
          ?.days.find((d) => d.day === day.day)?.shiftIds[sessionIndex];
        if (priorId && HASH(shiftAt(ctx, priorId, org.today).rules) === HASH(session.rules)) {
          shiftIds.push(priorId);
          continue;
        }
        const hash = HASH(session.rules);
        if (!created.has(hash)) {
          let serial = 1;
          let name;
          do {
            name = `${input.name.slice(0, 70)} — sesi ${serial++}`;
          } while (ctx.shifts.some((s) => s.name.trim().toLowerCase() === name.toLowerCase()));
          const saved = await saveMasterInTransaction(
            db,
            actor,
            {
              organizationId: input.organizationId,
              name,
              isActive: true,
              rules: session.rules,
            },
            "shifts",
            org,
          );
          created.set(hash, saved.id);
          ctx.shifts.push({ id: saved.id, name });
        }
        shiftIds.push(created.get(hash));
      }
      days.push({ day: day.day, shiftIds });
    }
    return saveMasterInTransaction(db, actor, { ...input, days }, "patterns", org);
  });
}
/** Opsi hanya referensi minimum, bukan perluasan hak pengelolaan master. */
export async function options(actor, org, q = "") {
  await repo.requireScheduleAccess(pool, actor, org, "work-schedules");
  const o = await repo.organization(pool, org);
  const patterns = (
    await pool.query(
      "SELECT id::text,name,pattern_type,cycle_days FROM shift_patterns WHERE organization_id=$1 AND is_active AND name ILIKE $2 ORDER BY name LIMIT 100",
      [org, "%" + q + "%"],
    )
  ).rows;
  const shifts = (
    await pool.query(
      "SELECT id::text,name FROM work_shifts WHERE organization_id=$1 AND is_active AND shift_type<>'off' AND name ILIKE $2 ORDER BY name LIMIT 100",
      [org, "%" + q + "%"],
    )
  ).rows;
  const ctx = await repo.context(pool, org);
  const calendarNames = (
    await pool.query("SELECT id::text,name FROM work_calendars WHERE organization_id=$1", [org])
  ).rows;
  for (const p of patterns) {
    const definition = patternAt(ctx, p.id, o.today);
    p.definitionRevisions = ctx.definitionRevisions.filter((r) => r.pattern_id === p.id);
    p.versions = p.definitionRevisions.map((r) => ({
      from: r.effective_from,
      pattern_type: r.pattern_type,
      holiday_policy: r.holiday_policy,
      allow_holiday_attendance: r.allow_holiday_attendance,
      calendar_name: calendarNames.find((c) => c.id === r.calendar_id)?.name || null,
      days: r.days.map((d) => ({
        day: d.day,
        sessions: d.shiftIds.map((shiftId) => ({
          shiftId,
          rules: shiftAt(
            ctx,
            shiftId,
            r.effective_from === "-infinity" ? o.today : r.effective_from,
          ).rules,
        })),
      })),
    }));
    p.holiday_policy = definition.holiday_policy;
    p.allow_holiday_attendance = definition.allow_holiday_attendance;
    p.calendar_name = calendarNames.find((c) => c.id === definition.calendar_id)?.name || null;
    p.days = definition.days.map((d) => ({
      day: d.day,
      sessions: d.shiftIds.map((shiftId) => {
        const s = shiftAt(ctx, shiftId, o.today);
        return { shiftId, rules: s.rules };
      }),
    }));
  }
  const locationScope = await getActorLocationScope(actor);
  const locations = (
    await pool.query(
      "SELECT id::text,name FROM locations WHERE organization_id=$1 AND is_active AND ($2::bigint[] IS NULL OR id=ANY($2)) ORDER BY name,id",
      [org, locationScope],
    )
  ).rows;
  const organizationUnits = (
    await pool.query(
      `SELECT u.id::text,u.name FROM organization_units u WHERE u.organization_id=$1 AND u.is_active
    AND ($2::bigint[] IS NULL OR EXISTS(SELECT 1 FROM organization_unit_locations l WHERE l.organization_id=u.organization_id AND l.organization_unit_id=u.id AND l.location_id=ANY($2) AND l.active_from<=$3 AND (l.active_until IS NULL OR l.active_until>=$3))) ORDER BY u.name,u.id`,
      [org, locationScope, o.today],
    )
  ).rows;
  const positions = (
    await pool.query(
      "SELECT id::text,name FROM positions WHERE organization_id=$1 AND is_active ORDER BY name,id",
      [org],
    )
  ).rows;
  const employmentTypes = (
    await pool.query(
      "SELECT id::text,name FROM employment_types WHERE organization_id=$1 AND is_active ORDER BY name,id",
      [org],
    )
  ).rows;
  return {
    patterns,
    shifts,
    adjustmentSchedules: await adjustmentOptions(pool, org, q, patterns, shiftAt, o.today, ctx),
    today: o.today,
    timezone: o.timezone,
    locations,
    organizationUnits,
    positions,
    employmentTypes,
  };
}
export async function listEmployees(
  actor,
  org,
  {
    q = "",
    page = 1,
    pageSize = 20,
    without = false,
    scheduleStatus = "all",
    employeeId = null,
    locationId = null,
    organizationUnitId = null,
    positionId = null,
    employmentTypeId = null,
  } = {},
) {
  await repo.requireScheduleAccess(pool, actor, org, "work-schedules");
  const o = await repo.organization(pool, org);
  const scope = await getActorLocationScope(actor);
  const r = await pool.query(
    `SELECT e.id::text,e.organization_id::text,e.profile_photo_file_id::text,e.employee_no,e.full_name,e.employment_status,e.joined_date::text,
 (SELECT COALESCE(max(a.version),0)::int FROM shift_assignments a WHERE a.organization_id=e.organization_id AND a.employee_id=e.id) AS assignment_version,
 (SELECT jsonb_agg(jsonb_build_object('id',a.id::text,'patternId',a.shift_pattern_id::text,'patternName',p.name,'from',a.effective_from::text,'until',a.effective_until::text,'anchorDate',a.anchor_date::text,'version',a.version,'cancelled',a.cancelled_at IS NOT NULL,'reason',a.change_reason,'cancellationReason',a.cancellation_reason,'createdAt',a.created_at,'createdBy',(SELECT display_name FROM v_user_identity WHERE user_id=a.created_by_user_id)) ORDER BY a.effective_from DESC,a.id DESC) FROM shift_assignments a JOIN shift_patterns p ON p.organization_id=a.organization_id AND p.id=a.shift_pattern_id WHERE a.organization_id=e.organization_id AND a.employee_id=e.id) AS assignments,
 count(*) OVER()::int AS total FROM employees e WHERE e.organization_id=$1 AND e.deleted_at IS NULL AND (e.full_name ILIKE $2 OR e.employee_no ILIKE $2)
 AND ($5::bigint[] IS NULL OR EXISTS(SELECT 1 FROM employee_assignments x WHERE x.organization_id=e.organization_id AND x.employee_id=e.id AND x.assignment_type='primary' AND x.location_id=ANY($5) AND x.effective_from<=$6::date AND (x.effective_until IS NULL OR x.effective_until>=$6::date)))
 AND (NOT $7 OR NOT EXISTS(SELECT 1 FROM shift_assignments a WHERE a.organization_id=e.organization_id AND a.employee_id=e.id AND a.cancelled_at IS NULL AND a.effective_from<=$6::date AND (a.effective_until IS NULL OR a.effective_until>=$6::date))) AND ($8::bigint IS NULL OR e.id=$8)
 AND (($9::bigint IS NULL AND $10::bigint IS NULL AND $11::bigint IS NULL) OR EXISTS(SELECT 1 FROM employee_assignments x WHERE x.organization_id=e.organization_id AND x.employee_id=e.id AND x.assignment_type='primary' AND x.effective_from<=$6 AND (x.effective_until IS NULL OR x.effective_until>=$6) AND ($9::bigint IS NULL OR x.location_id=$9) AND ($10::bigint IS NULL OR x.organization_unit_id=$10) AND ($11::bigint IS NULL OR x.position_id=$11) AND ($5::bigint[] IS NULL OR x.location_id=ANY($5))))
 AND ($12::text IS NULL OR ($12='without_active_contract' AND e.employment_status IN ('active','probation','suspended') AND NOT EXISTS(SELECT 1 FROM employment_contracts c WHERE c.organization_id=e.organization_id AND c.employee_id=e.id AND c.status='active' AND c.start_date<=$6 AND (c.end_date IS NULL OR c.end_date>=$6))) OR EXISTS(SELECT 1 FROM employment_contracts c WHERE c.organization_id=e.organization_id AND c.employee_id=e.id AND c.status='active' AND c.start_date<=$6 AND (c.end_date IS NULL OR c.end_date>=$6) AND c.employment_type_id::text=$12))
 AND ($13::text='all' OR EXISTS(SELECT 1 FROM shift_assignments a WHERE a.organization_id=e.organization_id AND a.employee_id=e.id AND a.cancelled_at IS NULL AND (a.effective_until IS NULL OR a.effective_until>=$6::date))=($13::text='assigned'))
 ORDER BY lower(e.full_name),e.id LIMIT $3 OFFSET $4`,
    [
      org,
      "%" + q + "%",
      pageSize,
      (page - 1) * pageSize,
      scope,
      o.today,
      without,
      employeeId,
      locationId,
      organizationUnitId,
      positionId,
      employmentTypeId,
      scheduleStatus,
    ],
  );
  return {
    data: r.rows.map(({ total, ...row }) => row),
    total: r.rows[0]?.total || 0,
    page,
    pageSize,
    today: o.today,
  };
}
export async function resolveDays(db, org, id, from, until, ctx, zone) {
  const { assignments, exceptions } = await repo.employeeRules(db, org, id);
  const calendars = (
    await db.query(
      "SELECT calendar_id::text,holiday_date::text,name FROM work_calendar_days WHERE organization_id=$1 AND holiday_date BETWEEN $2 AND $3",
      [org, from, until],
    )
  ).rows;
  const result = [];
  for (let d = from; d <= until; d = addDays(d, 1)) {
    const a = assignments.find(
      (x) => x.effective_from <= d && (!x.effective_until || x.effective_until >= d),
    );
    const p = patternAt(ctx, a?.shift_pattern_id, d);
    const ex = exceptions.find((x) => x.work_date === d);
    const holiday = calendars.find(
      (x) => x.calendar_id === String(p?.calendar_id) && x.holiday_date === d,
    );
    let ids = [];
    let status = "needs_review";
    if (ex) {
      ids = ex.shift_ids;
      status = ids.length ? "scheduled" : "off";
    } else if (p) {
      ids = p.days.find((x) => x.day === dayNumber(d, p, a.anchor_date))?.shiftIds || [];
      status = ids.length ? "scheduled" : "off";
      if (holiday && p.holiday_policy === "calendar") {
        ids = [];
        status = "holiday";
      }
    }
    const sessions = makeSessions(
      d,
      ids.map((x) => shiftAt(ctx, x, d)),
      zone,
    );
    if (status === "scheduled" && !sessions.length) status = "off";
    result.push({
      employeeId: String(id),
      date: d,
      status,
      isHoliday: Boolean(holiday),
      holidayName: holiday?.name || null,
      assignmentId: a?.id || null,
      exceptionId: ex?.id || null,
      exceptionVersion: ex?.version || 0,
      reason: ex?.reason || null,
      patternName: p?.name || null,
      allowHolidayAttendance: Boolean(p?.allow_holiday_attendance),
      sessions,
    });
  }
  // Jadwal terpakai adalah bukti historis: kalender dan master baru tidak mengubahnya.
  const frozen = (
    await db.query(
      `SELECT d.*,d.work_date::text, d.source_assignment_id::text,d.source_exception_id::text FROM employee_daily_schedules d WHERE d.organization_id=$1 AND d.employee_id=$2 AND d.work_date BETWEEN $3 AND $4 AND (EXISTS(SELECT 1 FROM attendance_events e WHERE e.organization_id=d.organization_id AND e.daily_schedule_id=d.id) OR EXISTS(SELECT 1 FROM attendance_daily_summaries a WHERE a.organization_id=d.organization_id AND a.employee_id=d.employee_id AND a.work_date=d.work_date))`,
      [org, id, from, until],
    )
  ).rows;
  for (const saved of frozen) {
    const d = result.find((x) => x.date === saved.work_date);
    const sessions = (
      await db.query(
        `SELECT s.*,s.shift_id::text,s.shift_revision_id::text,w.name FROM work_schedule_sessions s JOIN work_shifts w ON w.organization_id=s.organization_id AND w.id=s.shift_id WHERE s.organization_id=$1 AND s.daily_schedule_id=$2 ORDER BY s.session_no`,
        [org, saved.id],
      )
    ).rows;
    Object.assign(d, {
      allowHolidayAttendance: saved.allow_holiday_attendance,
      status: saved.status,
      isHoliday: saved.is_holiday,
      holidayName: saved.holiday_name,
      assignmentId: saved.source_assignment_id,
      exceptionId: saved.source_exception_id,
      protected: true,
      sessions: sessions.map((x) => ({
        sessionNo: x.session_no,
        shiftId: x.shift_id,
        revisionId: x.shift_revision_id,
        name: x.name,
        startsAt: x.starts_at.toISOString(),
        endsAt: x.ends_at.toISOString(),
        rules: x.rules,
      })),
    });
  }
  assertNoOverlap(result.flatMap((x) => x.sessions));
  return result;
}
export async function checkBoundary(db, org, id, from, until, ctx, zone) {
  const rows = await resolveDays(db, org, id, addDays(from, -1), addDays(until, 1), ctx, zone);
  const saved = (
    await db.query(
      `SELECT s.starts_at,s.ends_at FROM work_schedule_sessions s JOIN employee_daily_schedules d ON d.organization_id=s.organization_id AND d.id=s.daily_schedule_id WHERE s.organization_id=$1 AND s.employee_id=$2 AND (d.work_date=$3::date-1 OR d.work_date=$4::date+1)`,
      [org, id, from, until],
    )
  ).rows;
  const inside = rows.filter((x) => x.date >= from && x.date <= until).flatMap((x) => x.sessions);
  assertNoOverlap([...inside, ...saved.map((x) => ({ startsAt: x.starts_at, endsAt: x.ends_at }))]);
  return rows.filter((x) => x.date >= from && x.date <= until);
}
/** Utilisé dans la même transaction que le profil; aucune écriture hors transaction. */
export async function assignInTransaction(db, actor, input, requestId, orgInfo = null) {
  await repo.requireScheduleAccess(db, actor, input.organizationId, "work-schedules", true);
  const org = orgInfo || (await repo.organization(db, input.organizationId, true));
  dateAfter(input.from, org.today);
  if (input.until && input.until < input.from)
    fail("Tanggal akhir sebelum tanggal mulai.", "until");
  const ctx = await repo.context(db, input.organizationId);
  const p = patternAt(ctx, input.patternId, input.from);
  if (!p?.is_active) fail("Pola tidak tersedia.", "patternId");
  checkPatternTimes(ctx, p, input.from, org.timezone, true);
  if (
    p.calendar_id &&
    !(
      await db.query(
        "SELECT 1 FROM work_calendars WHERE organization_id=$1 AND id=$2 AND is_active",
        [input.organizationId, p.calendar_id],
      )
    ).rows.length
  )
    fail("Kalender tidak tersedia.", "patternId");
  for (const id of input.employeeIds.map(String).sort((a, b) => (BigInt(a) < BigInt(b) ? -1 : 1))) {
    const e = await repo.employee(db, actor, input.organizationId, id, true);
    if (!["active", "probation", "suspended"].includes(e.employment_status))
      fail("Status Pegawai belum dapat diberi jadwal.", "employeeIds");
    if (input.from < e.joined_date) fail("Jadwal tidak boleh sebelum tanggal bergabung.", "from");
    const previous = (
      await db.query(
        "SELECT *,effective_from::text,effective_until::text FROM shift_assignments WHERE organization_id=$1 AND employee_id=$2 ORDER BY id FOR UPDATE",
        [input.organizationId, id],
      )
    ).rows;
    const version = Math.max(0, ...previous.map((x) => x.version));
    if (input.expectedVersions?.[id] !== version)
      throw new ServiceError("VERSION_CONFLICT", "Jadwal berubah. Muat ulang.", 409, {
        employeeIds: "Muat ulang jadwal Pegawai.",
      });
    const active = previous.filter((x) => !x.cancelled_at);
    if (active.some((x) => x.effective_from >= input.from))
      fail("Sudah ada penetapan pada atau setelah tanggal tersebut.", "from");
    // Lindungi jadwal terpakai walaupun rencana dimulai hari ini.
    const used = await db.query(
      `SELECT d.work_date FROM employee_daily_schedules d WHERE d.organization_id=$1 AND d.employee_id=$2 AND d.work_date>=$3 AND ($4::date IS NULL OR d.work_date<=$4) AND (EXISTS(SELECT 1 FROM attendance_events e WHERE e.organization_id=d.organization_id AND e.daily_schedule_id=d.id) OR EXISTS(SELECT 1 FROM attendance_daily_summaries s WHERE s.organization_id=d.organization_id AND s.employee_id=d.employee_id AND s.work_date=d.work_date)) LIMIT 1`,
      [input.organizationId, id, input.from, input.until || null],
    );
    if (used.rows.length) fail("Jadwal sudah digunakan absensi atau keputusan HRD.", "from");
    await db.query(
      "UPDATE shift_assignments SET effective_until=$3::date-1,version=$4 WHERE organization_id=$1 AND employee_id=$2 AND cancelled_at IS NULL AND (effective_until IS NULL OR effective_until>=$3)",
      [input.organizationId, id, input.from, version + 1],
    );
    const anchor = p.pattern_type === "weekly" ? input.from : input.anchorDate;
    if (!anchor) fail("Isi tanggal acuan rotasi.", "anchorDate");
    await db.query(
      "INSERT INTO shift_assignments(organization_id,employee_id,shift_pattern_id,effective_from,effective_until,anchor_date,version,change_reason,created_by_user_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
      [
        input.organizationId,
        id,
        p.id,
        input.from,
        input.until || null,
        anchor,
        version + 1,
        input.reason,
        actor.id,
      ],
    );
    await checkBoundary(
      db,
      input.organizationId,
      id,
      input.from,
      addDays(input.from, p.cycle_days),
      ctx,
      org.timezone,
    );
  }
  await audit(
    db,
    actor,
    input.organizationId,
    "assign",
    input.employeeIds[0],
    { count: input.employeeIds.length, from: input.from, patternId: p.id },
    requestId,
  );
  return { assigned: input.employeeIds.length };
}
export const assign = (actor, input, requestId) =>
  mutation(actor, input, "work-schedules", "assign.request", requestId, (db, org) =>
    assignInTransaction(db, actor, input, requestId, org),
  );
export async function cancelAssignment(actor, input, requestId) {
  return mutation(actor, input, "work-schedules", "cancel", requestId, async (db, org) => {
    const a = (
      await db.query(
        "SELECT *,employee_id::text,effective_from::text FROM shift_assignments WHERE organization_id=$1 AND id=$2 FOR UPDATE",
        [input.organizationId, input.id],
      )
    ).rows[0];
    if (!a || !a.employee_id) throw new ServiceError("NOT_FOUND", "Jadwal tidak ditemukan.", 404);
    await repo.employee(db, actor, input.organizationId, a.employee_id, true);
    checkVersion(a, input.version);
    if (a.effective_from <= org.today)
      fail("Hanya penetapan mendatang yang dapat dibatalkan.", "id");
    const protectedRows = await db.query(
      `SELECT d.id FROM employee_daily_schedules d WHERE d.organization_id=$1 AND d.employee_id=$2 AND d.source_assignment_id=$3 AND (EXISTS(SELECT 1 FROM attendance_events e WHERE e.organization_id=d.organization_id AND e.daily_schedule_id=d.id) OR EXISTS(SELECT 1 FROM attendance_daily_summaries s WHERE s.organization_id=d.organization_id AND s.employee_id=d.employee_id AND s.work_date=d.work_date)) LIMIT 1`,
      [input.organizationId, a.employee_id, input.id],
    );
    if (protectedRows.rows.length) fail("Jadwal sudah digunakan absensi atau keputusan HRD.", "id");
    if (a.cancelled_at) fail("Penetapan sudah dibatalkan.", "id");
    await db.query(
      "UPDATE shift_assignments SET cancelled_at=now(),cancelled_by_user_id=$3,cancellation_reason=$4,version=version+1 WHERE organization_id=$1 AND id=$2",
      [input.organizationId, input.id, actor.id, input.reason],
    );
    return { id: input.id };
  });
}
export async function saveException(actor, input, requestId) {
  return mutation(actor, input, "work-schedules", "exception", requestId, async (db, org) => {
    if (!input.shiftIds.length) fail("Pilih jam kerja.", "shiftIds");
    dateAfter(input.date, org.today, "date");
    const e = await repo.employee(db, actor, input.organizationId, input.employeeId, true);
    if (!["active", "probation", "suspended"].includes(e.employment_status))
      fail("Status Pegawai tidak aktif.", "employeeId");
    if (input.date < e.joined_date) fail("Jadwal sebelum tanggal bergabung.", "date");
    await repo.requireBaseSchedule(db, input.organizationId, e, input.date, input.date);
    if (await repo.protectedDay(db, input.organizationId, input.employeeId, input.date))
      fail("Jadwal sudah digunakan absensi atau keputusan HRD.", "date");
    const old = (
      await db.query(
        "SELECT version FROM work_schedule_exceptions WHERE organization_id=$1 AND employee_id=$2 AND work_date=$3",
        [input.organizationId, input.employeeId, input.date],
      )
    ).rows[0];
    if ((old?.version || 0) !== input.version)
      throw new ServiceError("VERSION_CONFLICT", "Jadwal khusus berubah. Muat ulang.", 409);
    const ctx = await repo.context(db, input.organizationId);
    makeSessions(
      input.date,
      input.shiftIds.map((x) => workingShiftAt(ctx, x, input.date)),
      org.timezone,
    );
    const saved = (
      await db.query(
        "INSERT INTO work_schedule_exceptions(organization_id,employee_id,work_date,shift_ids,reason,created_by_user_id) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(organization_id,employee_id,work_date) DO UPDATE SET shift_ids=excluded.shift_ids,reason=excluded.reason,version=work_schedule_exceptions.version+1,updated_at=now() RETURNING id::text",
        [
          input.organizationId,
          input.employeeId,
          input.date,
          input.shiftIds,
          input.reason,
          actor.id,
        ],
      )
    ).rows[0];
    await db.query(
      "DELETE FROM work_schedule_exception_sessions WHERE organization_id=$1 AND exception_id=$2",
      [input.organizationId, saved.id],
    );
    for (const [index, shift] of input.shiftIds.entries())
      await db.query(
        "INSERT INTO work_schedule_exception_sessions(organization_id,exception_id,session_no,shift_id) VALUES($1,$2,$3,$4)",
        [input.organizationId, saved.id, index + 1, shift],
      );
    await checkBoundary(
      db,
      input.organizationId,
      input.employeeId,
      input.date,
      input.date,
      ctx,
      org.timezone,
    );
    return saved;
  });
}
export async function preview(actor, input) {
  await repo.requireScheduleAccess(pool, actor, input.organizationId, "work-schedules");
  validateRange(input.from, input.until);
  return withTransaction(async (db) => {
    await db.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const org = await repo.organization(db, input.organizationId);
    const ctx = await repo.context(db, input.organizationId);
    const rows = [];
    for (const id of [...new Set(input.employeeIds)]) {
      const e = await repo.employee(db, actor, input.organizationId, id);
      const days = await checkBoundary(
        db,
        input.organizationId,
        id,
        input.from,
        input.until,
        ctx,
        org.timezone,
      );
      for (const d of days) {
        const saved = (
          await db.query(
            "SELECT version FROM employee_daily_schedules WHERE organization_id=$1 AND employee_id=$2 AND work_date=$3",
            [input.organizationId, id, d.date],
          )
        ).rows[0];
        rows.push({ ...d, name: e.full_name, version: saved?.version || 0 });
      }
    }
    return rows;
  });
}
/** Preflight seluruh batch sebelum mengganti sesi agar benturan versi lama tidak memberi konflik palsu. */
export async function generate(actor, input, requestId) {
  return mutation(actor, input, "work-schedules", "generate", requestId, async (db, org) => {
    validateRange(input.from, input.until);
    dateAfter(input.from, org.today);
    const ctx = await repo.context(db, input.organizationId);
    const pending = [];
    let unchanged = 0;
    for (const id of [...new Set(input.employeeIds)].sort((a, b) =>
      BigInt(a) < BigInt(b) ? -1 : 1,
    )) {
      const e = await repo.employee(db, actor, input.organizationId, id, true);
      if (!["active", "probation", "suspended"].includes(e.employment_status))
        fail("Status Pegawai tidak aktif.", "employeeIds");
      const days = await checkBoundary(
        db,
        input.organizationId,
        id,
        input.from,
        input.until,
        ctx,
        org.timezone,
      );
      for (const d of days) {
        if (d.protected) {
          unchanged++;
          continue;
        }
        const hash = HASH(d);
        const old = (
          await db.query(
            "SELECT id::text,version,rule_hash FROM employee_daily_schedules WHERE organization_id=$1 AND employee_id=$2 AND work_date=$3 FOR UPDATE",
            [input.organizationId, id, d.date],
          )
        ).rows[0];
        if (old?.rule_hash === hash) {
          unchanged++;
          continue;
        }
        if (old) {
          if (!input.replace)
            throw new ServiceError("REPLACE_REQUIRED", "Konfirmasi pembaruan jadwal.", 409);
          if (input.expectedVersions[id + ":" + d.date] !== old.version)
            throw new ServiceError("VERSION_CONFLICT", "Jadwal berubah. Perbarui pratinjau.", 409);
          if (await repo.protectedDay(db, input.organizationId, id, d.date))
            fail("Jadwal sudah digunakan absensi atau keputusan HRD.", "from");
        }
        if (d.date < e.joined_date) fail("Jadwal sebelum tanggal bergabung.", "from");
        pending.push({ d, hash, old, id });
      }
    }
    const oldIds = pending.filter((x) => x.old).map((x) => x.old.id);
    if (oldIds.length)
      await db.query(
        "DELETE FROM work_schedule_sessions WHERE organization_id=$1 AND daily_schedule_id=ANY($2::bigint[])",
        [input.organizationId, oldIds],
      );
    for (const { d, hash, old, id } of pending) {
      const values = [
        input.organizationId,
        id,
        d.date,
        d.sessions[0]?.shiftId || null,
        d.assignmentId,
        d.sessions[0]?.startsAt || null,
        d.sessions.at(-1)?.endsAt || null,
        d.status,
        d.isHoliday,
        d.holidayName,
        d.exceptionId,
        hash,
        d.allowHolidayAttendance,
      ];
      let dailyId;
      if (old) {
        await db.query(
          "UPDATE employee_daily_schedules SET shift_id=$4,source_assignment_id=$5,scheduled_start_at=$6,scheduled_end_at=$7,status=$8,is_holiday=$9,holiday_name=$10,source_exception_id=$11,rule_hash=$12,allow_holiday_attendance=$13,version=version+1,generated_at=now() WHERE organization_id=$1 AND employee_id=$2 AND work_date=$3",
          values,
        );
        dailyId = old.id;
      } else
        dailyId = (
          await db.query(
            "INSERT INTO employee_daily_schedules(organization_id,employee_id,work_date,shift_id,source_assignment_id,scheduled_start_at,scheduled_end_at,status,is_holiday,holiday_name,source_exception_id,rule_hash,allow_holiday_attendance) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id::text",
            values,
          )
        ).rows[0].id;
      for (const s of d.sessions)
        await db.query(
          "INSERT INTO work_schedule_sessions(organization_id,daily_schedule_id,employee_id,session_no,shift_id,shift_revision_id,starts_at,ends_at,rules) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
          [
            input.organizationId,
            dailyId,
            id,
            s.sessionNo,
            s.shiftId,
            s.revisionId,
            s.startsAt,
            s.endsAt,
            s.rules,
          ],
        );
    }
    return { generated: pending.length, unchanged };
  });
}

/** Referensi minimum kalender/shift untuk penyusun pola; tidak membuka menu kalender. */
export async function masterOptions(actor, org, q = "") {
  await repo.requireScheduleAccess(pool, actor, org, "work-shifts");
  const info = await repo.organization(pool, org);
  return {
    today: info.today,
    timezone: info.timezone,
    shifts: (
      await pool.query(
        "SELECT id::text,name FROM work_shifts WHERE organization_id=$1 AND is_active AND name ILIKE $2 ORDER BY name LIMIT 100",
        [org, "%" + q + "%"],
      )
    ).rows,
    calendars: (
      await pool.query(
        "SELECT id::text,name FROM work_calendars WHERE organization_id=$1 AND is_active AND name ILIKE $2 ORDER BY name LIMIT 100",
        [org, "%" + q + "%"],
      )
    ).rows,
  };
}
