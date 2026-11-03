import { withTransaction } from "@/lib/dbTransaction";
import { ServiceError } from "@/lib/api/routeHelpers";
import * as repo from "./repository";
import { mutation, HASH, workingShiftAt, resolveDays, checkBoundary } from "./service";
import { adjustmentShiftIds, composeDailyAdjustment, hoursLabel } from "./dailyAdjustment.mjs";
import { patternAt } from "./definitionRevisions.mjs";
import { validateRange, dayDiff, addDays, assertNoOverlap, fail } from "./rules.mjs";

async function usedPatterns(db, input) {
  return (
    await db.query(
      `SELECT DISTINCT shift_pattern_id::text AS id FROM shift_assignments
    WHERE organization_id=$1 AND employee_id=ANY($2::bigint[]) AND cancelled_at IS NULL
    AND effective_from<=$4 AND (effective_until IS NULL OR effective_until>=$3)`,
      [input.organizationId, input.employeeIds, input.from, input.until],
    )
  ).rows.map((row) => row.id);
}

/** Read-only eligibility metadata. No employee names, reasons or mutation are returned. */
export async function additionalScheduleUsage(actor, input) {
  return withTransaction(async (db) => {
    await repo.requireScheduleAccess(db, actor, input.organizationId, "work-schedules", true);
    const org = await repo.organization(db, input.organizationId);
    validateRange(input.from, input.until);
    if (input.from < org.today) fail("Pilih tanggal mulai hari ini atau setelahnya.", "range");
    const people = [];
    for (const id of input.employeeIds) {
      const person = await repo.employee(db, actor, input.organizationId, id);
      if (!["active", "probation", "suspended"].includes(person.employment_status))
        fail("Pegawai yang dipilih tidak berstatus aktif.", "employeeIds");
      if (input.from < person.joined_date)
        fail("Tanggal yang dipilih sebelum tanggal bergabung Pegawai.", "range");
      await repo.requireBaseSchedule(db, input.organizationId, person, input.from, input.until);
      people.push(person);
    }
    const ctx = await repo.context(db, input.organizationId);
    const days = new Map();
    const periods = new Map();
    for (const person of people) {
      const rows = await resolveDays(
        db,
        input.organizationId,
        person.id,
        addDays(input.from, -1),
        addDays(input.until, 1),
        ctx,
        org.timezone,
      );
      for (const row of rows) {
        const inside = row.date >= input.from && row.date <= input.until;
        if (inside && !days.has(row.date)) days.set(row.date, new Set());
        for (const session of row.sessions) {
          if (inside) days.get(row.date).add(session.shiftId);
          periods.set(`${session.startsAt}:${session.endsAt}`, {
            startsAt: session.startsAt,
            endsAt: session.endsAt,
          });
        }
      }
      const saved = (
        await db.query(
          `SELECT s.starts_at,s.ends_at FROM work_schedule_sessions s JOIN employee_daily_schedules d ON d.organization_id=s.organization_id AND d.id=s.daily_schedule_id WHERE d.organization_id=$1 AND d.employee_id=$2 AND (d.work_date=$3::date-1 OR d.work_date=$4::date+1)`,
          [input.organizationId, person.id, input.from, input.until],
        )
      ).rows;
      for (const row of saved) {
        const startsAt = row.starts_at.toISOString(),
          endsAt = row.ends_at.toISOString();
        periods.set(`${startsAt}:${endsAt}`, { startsAt, endsAt });
      }
    }
    return {
      patternIds: await usedPatterns(db, input),
      definitionRevisions: ctx.definitionRevisions,
      days: [...days].map(([date, ids]) => ({ date, shiftIds: [...ids] })),
      timezone: org.timezone,
      periods: [...periods.values()],
      revisions: ctx.revisions
        .filter(
          (r) =>
            r.effective_from <= input.until &&
            (!r.effective_until || r.effective_until >= input.from),
        )
        .map((r) => ({
          id: r.id,
          shiftId: r.shift_id,
          from: r.effective_from,
          until: r.effective_until,
          rules: r.rules,
        })),
    };
  });
}

/** Bounded employee/date rectangle. All targets are authorized before any mutation. */
async function prepare(db, actor, input, lock = false) {
  const mode = input.mode || "replace";
  const org = await repo.organization(db, input.organizationId);
  validateRange(input.from, input.until);
  if (input.from < org.today) fail("Pilih tanggal mulai hari ini atau setelahnya.", "range");
  const ids = [...input.employeeIds].sort((a, b) => (BigInt(a) < BigInt(b) ? -1 : 1));
  const people = [];
  for (const id of ids) {
    const person = await repo.employee(db, actor, input.organizationId, id, lock);
    if (!["active", "probation", "suspended"].includes(person.employment_status))
      fail(
        `${person.full_name} tidak berstatus aktif. Tidak ada perubahan yang disimpan.`,
        "range",
      );
    if (input.from < person.joined_date)
      fail(
        `Tanggal yang dipilih untuk ${person.full_name} sebelum tanggal bergabung (${person.joined_date}).`,
        "range",
      );
    await repo.requireBaseSchedule(db, input.organizationId, person, input.from, input.until);
    people.push(person);
  }
  const ctx = await repo.context(db, input.organizationId);
  if (input.patternId && (await usedPatterns(db, input)).includes(input.patternId))
    fail(
      "Jadwal ini sudah digunakan pada tanggal yang dipilih. Pilih jadwal lain.",
      "patternId",
      mode === "add"
        ? "SCHEDULE_ALREADY_USED_FOR_ADDITION"
        : "SCHEDULE_ALREADY_USED_FOR_REPLACEMENT",
    );
  const dates = Array.from({ length: dayDiff(input.until, input.from) + 1 }, (_, i) =>
    addDays(input.from, i),
  );
  let selectedPattern,
    groupShiftId = null;
  if (input.patternId) {
    selectedPattern = ctx.patterns.find((p) => p.id === input.patternId && p.is_active);
    if (!selectedPattern)
      fail("Jadwal kerja tidak tersedia. Pilih jadwal yang aktif.", "patternId");
    const member = (
      await db.query(
        `SELECT i.shift_id::text,i.is_current,g.is_active
      FROM work_schedule_group_items i JOIN work_schedule_groups g ON g.organization_id=i.organization_id AND g.id=i.group_id
      WHERE i.organization_id=$1 AND i.pattern_id=$2`,
        [input.organizationId, input.patternId],
      )
    ).rows[0];
    if (member && (!member.is_current || !member.is_active))
      fail("Pilihan shift tidak tersedia. Muat ulang, lalu pilih shift yang aktif.", "patternId");
    groupShiftId = member?.shift_id || null;
  }
  const selectedByDate = new Map(
    dates.map((date) => [
      date,
      (selectedPattern
        ? adjustmentShiftIds(
            patternAt(ctx, selectedPattern.id, date),
            date,
            input.from,
            groupShiftId
              ? patternAt(ctx, selectedPattern.id, date).days.flatMap((d) => d.shiftIds)[0]
              : null,
          )
        : input.shiftIds
      ).map((id) => workingShiftAt(ctx, id, date)),
    ]),
  );
  const changes = [];
  const snapshot = [];
  let existingCount = 0;
  for (const person of people) {
    const used = (
      await db.query(
        `SELECT used.work_date::text FROM (
      SELECT s.work_date FROM attendance_daily_summaries s WHERE s.organization_id=$1 AND s.employee_id=$2 AND s.work_date BETWEEN $3 AND $4
      UNION ALL SELECT d.work_date FROM employee_daily_schedules d
      WHERE d.organization_id=$1 AND d.employee_id=$2 AND d.work_date BETWEEN $3 AND $4
      AND (EXISTS(SELECT 1 FROM attendance_events a WHERE a.organization_id=d.organization_id AND a.daily_schedule_id=d.id)
      OR EXISTS(SELECT 1 FROM attendance_daily_summaries s WHERE s.organization_id=d.organization_id AND s.employee_id=d.employee_id AND s.work_date=d.work_date))
      ) used ORDER BY used.work_date LIMIT 1`,
        [input.organizationId, person.id, input.from, input.until],
      )
    ).rows[0];
    if (used)
      throw new ServiceError(
        "SCHEDULE_ALREADY_USED",
        `Jadwal ${person.full_name} pada ${used.work_date} sudah digunakan absensi atau keputusan HRD. Pilih tanggal lain. Tidak ada perubahan yang disimpan.`,
        409,
      );
    const rows = await resolveDays(
      db,
      input.organizationId,
      person.id,
      addDays(input.from, -1),
      addDays(input.until, 1),
      ctx,
      org.timezone,
    );
    const personChanges = rows
      .filter((row) => row.date >= input.from && row.date <= input.until)
      .map((row) => {
        if (
          mode === "add" &&
          selectedByDate
            .get(row.date)
            .some((shift) => row.sessions.some((session) => session.shiftId === shift.id))
        )
          fail(
            `Jam kerja yang dipilih bertabrakan dengan jam kerja yang berlaku pada ${row.date}. Pilih jam kerja lain untuk ditambahkan.`,
            "patternId",
            "SESSION_OVERLAP",
          );
        return {
          employeeId: person.id,
          employeeName: person.full_name,
          employeeNo: person.employee_no,
          date: row.date,
          before: row.sessions,
          wasHoliday: row.status === "off" || row.status === "holiday",
          after: composeDailyAdjustment({
            date: row.date,
            before: row.sessions,
            shifts: selectedByDate.get(row.date),
            mode,
            timezone: org.timezone,
            employeeName: person.full_name,
          }),
        };
      });
    const desired = personChanges.flatMap((row) => row.after);
    changes.push(...personChanges);
    const boundaries = rows
      .filter((row) => row.date < input.from || row.date > input.until)
      .flatMap((row) => row.sessions);
    const saved = (
      await db.query(
        `SELECT s.starts_at,s.ends_at FROM work_schedule_sessions s JOIN employee_daily_schedules d ON d.organization_id=s.organization_id AND d.id=s.daily_schedule_id
      WHERE s.organization_id=$1 AND s.employee_id=$2 AND (d.work_date=$3::date-1 OR d.work_date=$4::date+1)`,
        [input.organizationId, person.id, input.from, input.until],
      )
    ).rows;
    try {
      assertNoOverlap([...desired, ...boundaries]);
      assertNoOverlap([
        ...desired,
        ...saved.map((s) => ({ startsAt: s.starts_at, endsAt: s.ends_at })),
      ]);
    } catch {
      const ordered = [
        ...desired,
        ...boundaries,
        ...saved.map((s) => ({ startsAt: s.starts_at, endsAt: s.ends_at })),
      ].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
      // Boundaries can also be present as stored snapshots. Find a target conflict,
      // rather than reporting duplicate copies of an unchanged boundary.
      const conflict = desired.flatMap((target) =>
        ordered
          .filter(
            (other) =>
              other !== target &&
              !desired.includes(other) &&
              Date.parse(target.startsAt) < Date.parse(other.endsAt) &&
              Date.parse(target.endsAt) > Date.parse(other.startsAt),
          )
          .map((other) => ({ target, other })),
      )[0];
      const target =
        conflict?.target ||
        desired.find((s, index) =>
          desired.slice(0, index).some((p) => Date.parse(s.startsAt) < Date.parse(p.endsAt)),
        ) ||
        desired[0];
      const date = target && personChanges.find((row) => row.after.includes(target))?.date;
      fail(
        `Jam kerja ${person.full_name}${date ? ` pada ${date}` : ""}${target ? ` (${hoursLabel(target.rules)})` : ""} bertabrakan dengan jadwal pada tanggal yang berdekatan. Pilih jam kerja atau tanggal lain.`,
        "range",
      );
    }
    const versions = (
      await db.query(
        "SELECT id::text,version FROM shift_assignments WHERE organization_id=$1 AND employee_id=$2 ORDER BY id",
        [input.organizationId, person.id],
      )
    ).rows;
    existingCount += rows.filter(
      (r) => r.date >= input.from && r.date <= input.until && r.exceptionId,
    ).length;
    snapshot.push({ person, rows, versions });
  }
  return {
    ctx,
    changes,
    dates,
    people,
    org,
    previewHash: HASH({
      input: {
        organizationId: input.organizationId,
        employeeIds: ids,
        from: input.from,
        until: input.until,
        shiftIds: input.shiftIds,
        patternId: input.patternId,
        mode,
      },
      snapshot,
      // Database row order is not a version change. Preserve only stable ID order.
      ctx: Object.fromEntries(
        Object.entries(ctx).map(([key, rows]) => [
          key,
          [...rows].sort((a, b) =>
            BigInt(a.id) < BigInt(b.id) ? -1 : BigInt(a.id) > BigInt(b.id) ? 1 : 0,
          ),
        ]),
      ),
    }),
    employeeCount: people.length,
    dayCount: dates.length,
    changeCount: people.length * dates.length,
    existingCount,
  };
}
export async function previewBulkException(actor, input) {
  return withTransaction(async (db) => {
    await repo.requireScheduleAccess(db, actor, input.organizationId, "work-schedules", true);
    const result = await prepare(db, actor, input);
    const { previewHash, employeeCount, dayCount, changeCount, existingCount, changes, org } =
      result;
    return {
      previewHash,
      employeeCount,
      dayCount,
      changeCount,
      existingCount,
      changes,
      timezone: org.timezone,
    };
  });
}
export async function saveBulkException(actor, input, requestId) {
  return mutation(actor, input, "work-schedules", "exception.bulk", requestId, async (db) => {
    const prepared = await prepare(db, actor, input, true);
    if (prepared.previewHash !== input.previewHash)
      throw new ServiceError(
        "VERSION_CONFLICT",
        "Jadwal atau data Pegawai telah berubah. Kembali ke form, lalu tinjau perubahan lagi. Tidak ada perubahan yang disimpan.",
        409,
      );
    for (const person of prepared.people) {
      const payload = JSON.stringify(
        prepared.changes
          .filter((row) => row.employeeId === person.id)
          .map((row) => ({
            date: row.date,
            shift_ids: row.after.map((session) => session.shiftId),
          })),
      );
      const saved = (
        await db.query(
          `INSERT INTO work_schedule_exceptions(organization_id,employee_id,work_date,shift_ids,reason,created_by_user_id)
        SELECT $1,$2,x.date,x.shift_ids,$4,$5 FROM jsonb_to_recordset($3::jsonb) AS x(date date,shift_ids bigint[])
        ON CONFLICT(organization_id,employee_id,work_date) DO UPDATE SET shift_ids=excluded.shift_ids,reason=excluded.reason,version=work_schedule_exceptions.version+1,updated_at=now()
        RETURNING id::text`,
          [input.organizationId, person.id, payload, input.reason, actor.id],
        )
      ).rows;
      await db.query(
        "DELETE FROM work_schedule_exception_sessions WHERE organization_id=$1 AND exception_id=ANY($2::bigint[])",
        [input.organizationId, saved.map((row) => row.id)],
      );
      await db.query(
        `INSERT INTO work_schedule_exception_sessions(organization_id,exception_id,session_no,shift_id)
        SELECT $1,e.id,s.ordinality::smallint,s.id FROM jsonb_to_recordset($3::jsonb) AS x(date date,shift_ids bigint[])
        JOIN work_schedule_exceptions e ON e.organization_id=$1 AND e.employee_id=$2 AND e.work_date=x.date
        CROSS JOIN LATERAL unnest(x.shift_ids) WITH ORDINALITY s(id,ordinality)`,
        [input.organizationId, person.id, payload],
      );
      await checkBoundary(
        db,
        input.organizationId,
        person.id,
        input.from,
        input.until,
        prepared.ctx,
        prepared.org.timezone,
      );
    }
    return {
      employeeCount: prepared.employeeCount,
      dayCount: prepared.dayCount,
      changeCount: prepared.changeCount,
      from: input.from,
      until: input.until,
      mode: input.mode || "replace",
      // Audited with the receipt: a mutable source name cannot erase what was applied.
      changes: prepared.changes.map((row) => ({
        employeeId: row.employeeId,
        date: row.date,
        before: row.before.map(({ shiftId, revisionId }) => ({ shiftId, revisionId })),
        after: row.after.map(({ shiftId, revisionId }) => ({ shiftId, revisionId })),
      })),
    };
  });
}
