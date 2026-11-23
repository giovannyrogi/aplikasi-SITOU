/** Counts work dates, never sessions or pending applications. The caller provides
 * verified identity/permissions; no selector is accepted from the mobile client. */
export async function readMobileMonthSummary(db, actor, resolveWorkDays) {
  const args = [actor.organizationId, actor.employeeId, actor.timezone];
  const {
    rows: [clock],
  } = await db.query(
    `SELECT
    to_char(statement_timestamp() AT TIME ZONE $1,'YYYY-MM') AS month,
    date_trunc('month',statement_timestamp() AT TIME ZONE $1)::date::text AS first,
    (statement_timestamp() AT TIME ZONE $1)::date::text AS today`,
    [actor.timezone],
  );
  const range = [args[0], args[1], clock.first, clock.today];
  let presentDays = null,
    lateDays = null,
    leaveDays = null;
  if (actor.attendanceAllowed) {
    const {
      rows: [totals],
    } = await db.query(
      `SELECT
      count(DISTINCT work_date) FILTER(WHERE first_check_in IS NOT NULL OR last_check_out IS NOT NULL
        OR attendance_status IN ('present','late'))::int AS present,
      count(DISTINCT work_date) FILTER(WHERE late_minutes>0 OR attendance_status='late')::int AS late
      FROM attendance_daily_summaries WHERE organization_id=$1 AND employee_id=$2
        AND work_date BETWEEN $3::date AND $4::date`,
      range,
    );
    presentDays = totals.present;
    lateDays = totals.late;
  }
  if (actor.leaveAllowed) {
    const days = new Set();
    const { rows: approved } = await db.query(
      `SELECT start_at,end_at,schedule_snapshot,
        coalesce(schedule_snapshot->>'workDate',(start_at AT TIME ZONE $5)::date::text) AS first,
        coalesce(schedule_snapshot->>'throughDate',(end_at AT TIME ZONE $5)::date::text) AS last
      FROM leave_requests WHERE organization_id=$1 AND employee_id=$2 AND status='approved'
        AND coalesce((schedule_snapshot->>'workDate')::date,(start_at AT TIME ZONE $5)::date) <= $4::date
        AND coalesce((schedule_snapshot->>'throughDate')::date,(end_at AT TIME ZONE $5)::date) >= $3::date`,
      [...range, actor.timezone],
    );
    // New requests retain historical work dates; legacy HRD entries use the same
    // schedule resolver as leave preview, rather than counting weekends as leave.
    const legacy = approved.some((r) => !Array.isArray(r.schedule_snapshot?.days))
      ? await resolveWorkDays(clock.first, clock.today)
      : [];
    for (const r of approved) {
      const candidates = Array.isArray(r.schedule_snapshot?.days)
        ? r.schedule_snapshot.days
        : legacy;
      for (const day of candidates)
        if (
          day.status === "scheduled" &&
          day.sessions?.length &&
          day.date >= clock.first &&
          day.date <= clock.today &&
          day.date >= r.first &&
          day.date <= r.last
        )
          days.add(day.date);
    }
    // Manual/legacy summaries remain valid sources too; Set prevents duplicates.
    const { rows: recorded } = await db.query(
      `SELECT work_date::text AS date FROM attendance_daily_summaries
      WHERE organization_id=$1 AND employee_id=$2 AND work_date BETWEEN $3::date AND $4::date
        AND attendance_status IN ('leave','permission','sick','official_duty')`,
      range,
    );
    for (const r of recorded) days.add(r.date);
    leaveDays = days.size;
  }
  return { month: clock.month, throughDate: clock.today, presentDays, leaveDays, lateDays };
}
