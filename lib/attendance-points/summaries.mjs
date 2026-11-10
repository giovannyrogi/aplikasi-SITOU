import { assessAttendance } from "./timing.mjs";

const milliseconds = (value) => new Date(value).getTime();
const minutes = (seconds) => Math.floor(seconds / 60);
const outsideId = (dayId, number) => `outside:${dayId}:${number}`;

/** Hanya pasangan masuk/pulang lengkap dihitung sebagai durasi kerja. */
export function calculateDailySummary(sessions, events, instant, latestCheckIn, day = {}) {
  const holidayWork = events.length > 0 && events.every((e) => e.work_context === "holiday_work");
  if (holidayWork) {
    sessions = [{ id: "holiday", session_no: 1, rules: { type: "holiday_work" } }];
    events = events.map((e) => ({ ...e, schedule_session_id: "holiday" }));
    if (
      latestCheckIn &&
      !latestCheckIn.schedule_session_id &&
      String(latestCheckIn.daily_schedule_id) === String(day.id)
    )
      latestCheckIn = { ...latestCheckIn, schedule_session_id: "holiday" };
  }
  const outsideNumbers = [...new Set(events
    .filter((event) => event.work_context === "outside_schedule")
    .map((event) => event.outside_schedule_session_no))];
  if (outsideNumbers.length) {
    sessions = [...sessions, ...outsideNumbers.map((number) => ({
      id: outsideId(day.id, number), session_no: number, rules: { type: "outside_schedule" },
    }))];
    events = events.map((event) => event.work_context === "outside_schedule"
      ? { ...event, schedule_session_id: outsideId(day.id, event.outside_schedule_session_no) }
      : event);
  }
  if (latestCheckIn?.outside_schedule_session_no != null) {
    latestCheckIn = { ...latestCheckIn, schedule_session_id: outsideId(
      latestCheckIn.daily_schedule_id, latestCheckIn.outside_schedule_session_no,
    ) };
  }
  const now = milliseconds(instant);
  let completed = 0,
    open = 0,
    missingIn = 0,
    missingOut = 0,
    waiting = 0;
  let outsideSeconds = 0;
  let netSeconds = 0,
    earlyArrival = 0,
    late = 0,
    earlyLeave = 0,
    lateDeparture = 0,
    lateCount = 0,
    earlyLeaveCount = 0;
  let invalid = false;
  const unassessed = events.filter((event) => ![1, 2].includes(event.assessment_version)).length;
  const unassigned = events.filter(
    (event) =>
      !sessions.some((session) => String(session.id) === String(event.schedule_session_id)),
  ).length;
  const details = [];
  let scheduled = 0;
  for (const session of sessions) {
    const rules = session.rules;
    const outside = rules.type === "outside_schedule";
    const plannedSeconds = Math.max(
      0,
      (milliseconds(session.ends_at) - milliseconds(session.starts_at)) / 1000,
    );
    const breakSeconds = rules.deductBreak ? (rules.breakMinutes ?? 0) * 60 : 0;
    scheduled +=
      rules.type === "fixed"
        ? minutes(Math.max(0, plannedSeconds - breakSeconds))
        : (rules.requiredMinutes ?? 0);
    const matching = events.filter(
      (event) => String(event.schedule_session_id) === String(session.id),
    );
    const ins = matching.filter((event) => event.event_type === "check_in");
    const outs = matching.filter((event) => event.event_type === "check_out");
    const entry = ins.length === 1 ? ins[0] : null;
    const exit = outs.length === 1 ? outs[0] : null;
    const duplicate = ins.length > 1 || outs.length > 1;
    invalid ||= duplicate || Boolean(exit && !entry);
    const assessmentSession = {
      startsAt: session.starts_at,
      endsAt: session.ends_at,
      rules,
      entered: entry?.occurred_at,
    };
    for (const event of [entry, exit].filter(Boolean)) {
      if (outside) continue;
      const fallback = assessAttendance(
        assessmentSession,
        event.event_type,
        event.occurred_at,
      ).timing;
      const timing = [1, 2].includes(event.assessment_version)
        ? {
            earlyArrivalMinutes: event.early_arrival_minutes,
            lateMinutes: event.late_minutes,
            earlyLeaveMinutes: event.early_leave_minutes,
            lateDepartureMinutes: event.late_departure_minutes,
            category: event.timing_category,
          }
        : fallback;
      earlyArrival += timing.earlyArrivalMinutes;
      late += timing.lateMinutes;
      earlyLeave += timing.earlyLeaveMinutes;
      lateDeparture += timing.lateDepartureMinutes;
      if (timing.category === "late_check_in") lateCount++;
      if (timing.category === "early_check_out") earlyLeaveCount++;
    }
    let status = "waiting",
      workedSeconds = null;
    if (duplicate || (exit && !entry)) status = "needs_review";
    else if (entry && exit) {
      if (milliseconds(exit.occurred_at) < milliseconds(entry.occurred_at)) {
        invalid = true;
        status = "needs_review";
      } else {
        workedSeconds = Math.max(
          0,
          Math.floor((milliseconds(exit.occurred_at) - milliseconds(entry.occurred_at)) / 1000) -
            breakSeconds,
        );
        netSeconds += workedSeconds;
        if (outside) outsideSeconds += workedSeconds;
        completed++;
        status = "complete";
      }
    } else if (entry) {
      if (
        latestCheckIn &&
        String(latestCheckIn.schedule_session_id) !== String(session.id) &&
        milliseconds(latestCheckIn.occurred_at) > milliseconds(entry.occurred_at)
      ) {
        missingOut++;
        status = "missing_check_out";
      } else {
        open++;
        status = "open";
      }
    } else if (!holidayWork && !outside && now >= milliseconds(session.ends_at)) {
      missingIn++;
      status = "missing_check_in";
    } else waiting++;
    details.push({
      sessionId: String(session.id),
      sessionNo: session.session_no,
      ...(outside ? { workContext: "outside_schedule" } : {}),
      status,
      entry: entry ? { id: String(entry.id), eventDate: entry.event_date } : null,
      exit: exit ? { id: String(exit.id), eventDate: exit.event_date } : null,
      workedSeconds,
    });
  }
  const needsReview = invalid || unassigned > 0 || unassessed > 0 || !sessions.length;
  return {
    firstCheckIn: events.find((event) => event.event_type === "check_in")?.occurred_at ?? null,
    lastCheckOut: events.findLast((event) => event.event_type === "check_out")?.occurred_at ?? null,
    workedMinutes: minutes(netSeconds),
    scheduledMinutes: holidayWork ? null : scheduled,
    workedOnDayOff: holidayWork,
    timingApplicable: !holidayWork,
    lateMinutes: holidayWork ? null : late,
    earlyLeaveMinutes: holidayWork ? null : earlyLeave,
    earlyArrivalMinutes: holidayWork ? null : earlyArrival,
    lateDepartureMinutes: holidayWork ? null : lateDeparture,
    scheduledSessions: holidayWork ? 0 : sessions.length - outsideNumbers.length,
    completedSessions: completed,
    openSessions: open,
    missingCheckIn: missingIn,
    missingCheckOut: missingOut,
    unassessedEvents: unassessed,
    outsideEvents: events.filter((event) => event.geofence_status === "outside").length,
    attendanceStatus: needsReview || outsideNumbers.length > 0
      ? "needs_review"
      : holidayWork
        ? day.status === "holiday"
          ? "holiday"
          : "off"
        : completed !== sessions.length
          ? "incomplete"
          : lateCount
            ? "late"
            : "present",
    details: {
      version: outsideNumbers.length ? 3 : 2,
      ...(outsideNumbers.length ? {
        outsideScheduleSessions: outsideNumbers.length,
        outsideScheduleWorkedMinutes: minutes(outsideSeconds),
      } : {}),
      workContext: holidayWork ? "holiday_work" : "scheduled",
      dayStatus: day.status || null,
      holidayName: day.holiday_name || null,
      durationComplete: !needsReview && completed === sessions.length,
      workedSeconds: netSeconds,
      waitingSessions: waiting,
      unassignedEvents: unassigned,
      lateEventCount: lateCount,
      earlyLeaveEventCount: earlyLeaveCount,
      sessions: details,
    },
  };
}

/** Pemanggil wajib membuka transaksi. Urutan lock sama dengan penyimpanan mobile. */
export async function refreshAttendanceSummaries(db, organizationId, employeeId, dates, instant) {
  await db.query("SELECT id FROM organizations WHERE id=$1 FOR NO KEY UPDATE", [organizationId]);
  await db.query("SELECT id FROM employees WHERE organization_id=$1 AND id=$2 FOR NO KEY UPDATE", [
    organizationId,
    employeeId,
  ]);
  const latest = (
    await db.query(
      `SELECT schedule_session_id::text,daily_schedule_id::text,occurred_at,outside_schedule_session_no FROM attendance_events
     WHERE organization_id=$1 AND employee_id=$2 AND event_type='check_in'
       AND validation_status='valid' AND daily_schedule_id IS NOT NULL
     ORDER BY occurred_at DESC,event_date DESC,id DESC LIMIT 1`,
      [organizationId, employeeId],
    )
  ).rows[0];
  const outcomes = [];
  for (const date of [...new Set(dates)].sort()) {
    const day = (
      await db.query(
        "SELECT id::text,status,holiday_name FROM employee_daily_schedules WHERE organization_id=$1 AND employee_id=$2 AND work_date=$3 FOR UPDATE",
        [organizationId, employeeId, date],
      )
    ).rows[0];
    if (!day) {
      outcomes.push({ date, updated: false, reason: "no_snapshot" });
      continue;
    }
    const existing = (
      await db.query(
        "SELECT is_manual_override,attendance_status,approved_overtime_minutes FROM attendance_daily_summaries WHERE organization_id=$1 AND employee_id=$2 AND work_date=$3 FOR UPDATE",
        [organizationId, employeeId, date],
      )
    ).rows[0];
    if (
      existing?.is_manual_override ||
      ["leave", "permission", "sick", "official_duty"].includes(existing?.attendance_status)
    ) {
      outcomes.push({ date, updated: false, reason: "protected_decision" });
      continue;
    }
    const sessions = (
      await db.query(
        "SELECT id::text,session_no,starts_at,ends_at,rules FROM work_schedule_sessions WHERE organization_id=$1 AND employee_id=$2 AND daily_schedule_id=$3 ORDER BY session_no",
        [organizationId, employeeId, day.id],
      )
    ).rows;
    const events = (
      await db.query(
        `SELECT id::text,event_date::text,event_type,occurred_at,schedule_session_id::text,
        assessment_version,timing_category,early_arrival_minutes,late_minutes,early_leave_minutes,late_departure_minutes,geofence_status,work_context,outside_schedule_session_no
       FROM attendance_events WHERE organization_id=$1 AND employee_id=$2 AND daily_schedule_id=$3
       AND validation_status='valid' AND event_type IN ('check_in','check_out') ORDER BY occurred_at,event_date,id`,
        [organizationId, employeeId, day.id],
      )
    ).rows;
    if (!events.length) {
      outcomes.push({ date, updated: false, reason: "no_events" });
      continue;
    }
    if (
      ["off", "holiday"].includes(existing?.attendance_status) &&
      !events.every((e) => e.work_context === "holiday_work")
    ) {
      outcomes.push({ date, updated: false, reason: "protected_decision" });
      continue;
    }
    const summary = calculateDailySummary(sessions, events, instant, latest, day);
    if ((existing?.approved_overtime_minutes ?? 0) > summary.lateDepartureMinutes) {
      summary.attendanceStatus = "needs_review";
      summary.details.approvalRequiresReview = true;
    }
    await db.query(
      `INSERT INTO attendance_daily_summaries(
        organization_id,employee_id,work_date,daily_schedule_id,first_check_in,last_check_out,
        worked_minutes,late_minutes,early_leave_minutes,overtime_candidate_minutes,attendance_status,
        calculation_version,scheduled_minutes,early_arrival_minutes,late_departure_minutes,
        scheduled_session_count,completed_session_count,open_session_count,missing_check_in_count,
        missing_check_out_count,unassessed_event_count,outside_event_count,calculation_details,calculated_at,worked_on_day_off,timing_applicable)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'attendance_v1',$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)
       ON CONFLICT(organization_id,employee_id,work_date) DO UPDATE SET
        daily_schedule_id=EXCLUDED.daily_schedule_id,first_check_in=EXCLUDED.first_check_in,last_check_out=EXCLUDED.last_check_out,
        worked_minutes=EXCLUDED.worked_minutes,late_minutes=EXCLUDED.late_minutes,
        early_leave_minutes=EXCLUDED.early_leave_minutes,overtime_candidate_minutes=EXCLUDED.overtime_candidate_minutes,
        attendance_status=EXCLUDED.attendance_status,calculation_version=EXCLUDED.calculation_version,
        scheduled_minutes=EXCLUDED.scheduled_minutes,early_arrival_minutes=EXCLUDED.early_arrival_minutes,
        late_departure_minutes=EXCLUDED.late_departure_minutes,scheduled_session_count=EXCLUDED.scheduled_session_count,
        completed_session_count=EXCLUDED.completed_session_count,open_session_count=EXCLUDED.open_session_count,
        missing_check_in_count=EXCLUDED.missing_check_in_count,missing_check_out_count=EXCLUDED.missing_check_out_count,
        unassessed_event_count=EXCLUDED.unassessed_event_count,outside_event_count=EXCLUDED.outside_event_count,
        calculation_details=EXCLUDED.calculation_details,calculated_at=EXCLUDED.calculated_at,calculated_by_user_id=NULL,
        worked_on_day_off=EXCLUDED.worked_on_day_off,timing_applicable=EXCLUDED.timing_applicable
       WHERE NOT attendance_daily_summaries.is_manual_override
         AND attendance_daily_summaries.attendance_status NOT IN ('leave','permission','sick','official_duty')
         AND (attendance_daily_summaries.attendance_status NOT IN ('off','holiday') OR EXCLUDED.worked_on_day_off)`,
      [
        organizationId,
        employeeId,
        date,
        day.id,
        summary.firstCheckIn,
        summary.lastCheckOut,
        summary.workedMinutes,
        summary.lateMinutes,
        summary.earlyLeaveMinutes,
        summary.lateDepartureMinutes,
        summary.attendanceStatus,
        summary.scheduledMinutes,
        summary.earlyArrivalMinutes,
        summary.lateDepartureMinutes,
        summary.scheduledSessions,
        summary.completedSessions,
        summary.openSessions,
        summary.missingCheckIn,
        summary.missingCheckOut,
        summary.unassessedEvents,
        summary.outsideEvents,
        JSON.stringify(summary.details),
        instant,
        summary.workedOnDayOff,
        summary.timingApplicable,
      ],
    );
    outcomes.push({ date, updated: true });
  }
  return outcomes;
}
