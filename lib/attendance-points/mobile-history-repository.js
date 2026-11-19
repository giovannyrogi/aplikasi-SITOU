export async function clockFor(db, actor) {
  return (
    await db.query(
      `SELECT o.timezone, clock.instant AS now,
        (clock.instant AT TIME ZONE o.timezone)::date::text AS today,
        least(
          (clock.instant AT TIME ZONE o.timezone)::date,
          coalesce(least(e.joined_date, first_work.work_date, first_entry.event_date),
            (e.created_at AT TIME ZONE o.timezone)::date)
        )::text AS "firstDate"
      FROM organizations o JOIN employees e ON e.organization_id=o.id
      CROSS JOIN (SELECT statement_timestamp() AS instant) clock
      LEFT JOIN LATERAL (
        SELECT d.work_date FROM employee_daily_schedules d
        WHERE d.organization_id=e.organization_id AND d.employee_id=e.id
          AND EXISTS (SELECT 1 FROM attendance_events a
            WHERE a.organization_id=d.organization_id AND a.employee_id=d.employee_id
              AND a.daily_schedule_id=d.id AND a.validation_status='valid'
              AND a.event_type IN ('check_in','check_out'))
        ORDER BY d.work_date LIMIT 1
      ) first_work ON true
      LEFT JOIN LATERAL (
        SELECT a.event_date FROM attendance_events a
        WHERE a.organization_id=e.organization_id AND a.employee_id=e.id
          AND a.validation_status='valid' AND a.event_type IN ('check_in','check_out')
        ORDER BY a.occurred_at LIMIT 1
      ) first_entry ON true
      WHERE o.id=$1 AND o.is_active AND e.id=$2 AND e.deleted_at IS NULL`,
      actor.ids,
    )
  ).rows[0];
}

export async function attendanceEventsFor(db, { ids }, from, until) {
  return (
    await db.query(
      `SELECT a.id::text, a.event_date::text AS "eventDate", a.event_type AS "type",
        coalesce(d.work_date,a.event_date)::text AS "workDate", a.daily_schedule_id::text AS "dailyId",
        a.schedule_session_id::text AS "sessionId", s.session_no AS "sessionNo", a.outside_schedule_session_no AS "outsideNo",
        a.work_context AS "context", a.occurred_at AS "occurredAt",
        coalesce(nullif(a.validation_details->'result'->>'holidayName',''),d.holiday_name) AS "holidayName",
        coalesce(a.point_name_snapshot,a.validation_details->'result'->>'pointName') AS "point",
        a.organization_timezone_snapshot AS "timezone", a.timing_category AS "timing",
        a.early_arrival_minutes AS "earlyArrival", a.late_minutes AS late,
        a.early_leave_minutes AS "earlyLeave", a.late_departure_minutes AS "lateDeparture",
        coalesce(s.starts_at,d.scheduled_start_at) AS "startsAt",
        coalesce(s.ends_at,d.scheduled_end_at) AS "endsAt",
        coalesce(a.validation_details->'result'->>'sessionName',shift.name,legacy_shift.name) AS "shiftName",
        q.status AS "correctionStatus"
      FROM attendance_events a
      LEFT JOIN employee_daily_schedules d ON (d.organization_id,d.employee_id,d.id) =
        (a.organization_id,a.employee_id,a.daily_schedule_id)
      LEFT JOIN work_schedule_sessions s ON (s.organization_id,s.employee_id,s.id) =
        (a.organization_id,a.employee_id,a.schedule_session_id)
      LEFT JOIN work_shifts shift ON (shift.organization_id,shift.id)=(s.organization_id,s.shift_id)
      LEFT JOIN work_shifts legacy_shift ON (legacy_shift.organization_id,legacy_shift.id)=(d.organization_id,d.shift_id)
      LEFT JOIN LATERAL (
        SELECT q.status FROM attendance_correction_requests q
        WHERE q.organization_id=a.organization_id AND q.employee_id=a.employee_id
          AND q.work_date=coalesce(d.work_date,a.event_date)
          AND q.session_key=CASE WHEN s.session_no IS NOT NULL THEN 'scheduled:' || s.session_no
            WHEN a.work_context='outside_schedule' THEN 'outside:' || a.outside_schedule_session_no
            WHEN a.work_context='holiday_work' THEN 'holiday'
            ELSE 'legacy:' || a.event_date || ':' || a.id END
          AND q.status IN ('pending','approved')
        ORDER BY (q.status='pending') DESC,q.id DESC LIMIT 1
      ) q ON true
      WHERE a.organization_id=$1 AND a.employee_id=$2
        AND a.validation_status='valid' AND a.event_type IN ('check_in','check_out')
        AND ((d.work_date >= $3 AND d.work_date < $4) OR
          (d.id IS NULL AND a.event_date >= $3 AND a.event_date < $4))
      ORDER BY a.occurred_at,a.id`,
      [...ids, from, until],
    )
  ).rows;
}

const correctionColumns = `id::text, work_date::text AS "workDate", status, reason,
  correction_part AS part, session_key AS "sessionKey", basis_snapshot AS basis,
  requested_checkin_at AS "requestedArrival", payload_hash AS "payloadHash",
  requested_checkout_at AS "requestedAt", timezone, created_at AS "createdAt",
  review_note AS "reviewNote"`;

export async function correctionRequestsFor(db, { ids }, before, limit, includeArrival = true) {
  return (
    await db.query(
      `SELECT ${correctionColumns}
      FROM attendance_correction_requests WHERE organization_id=$1 AND employee_id=$2
        AND ($3::bigint IS NULL OR id<$3)
        AND ($5::boolean OR requested_checkout_at IS NOT NULL)
      ORDER BY id DESC LIMIT $4`,
      [...ids, before, limit, includeArrival],
    )
  ).rows;
}

export async function findRequest(db, { ids }, key) {
  return (
    await db.query(
      `SELECT ${correctionColumns},source_event_date::text AS "eventDate",source_event_id::text AS "eventId"
      FROM attendance_correction_requests WHERE organization_id=$1 AND employee_id=$2 AND request_key=$3`,
      [...ids, key],
    )
  ).rows[0];
}

export async function insertCorrection(db, actor, selected, input, arrival, departure, timezone, payloadHash) {
  const source = selected.entry?.arrival || selected.entry?.departure;
  return (
    await db.query(
      `INSERT INTO attendance_correction_requests(
        organization_id,employee_id,source_event_date,source_event_id,work_date,
        requested_checkout_at,timezone,reason,request_key,requested_by_user_id,
        requested_checkin_at,correction_part,session_key,basis_snapshot,payload_hash
      ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      ON CONFLICT DO NOTHING RETURNING ${correctionColumns}`,
      [...actor.ids, source?.eventDate ?? null, source?.id ?? null, input.workDate,
        departure, timezone, input.reason, input.requestKey, actor.id,
        arrival,input.part,selected.sessionKey,JSON.stringify(selected.basis),payloadHash],
    )
  ).rows[0];
}
