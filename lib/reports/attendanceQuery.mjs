/** Penempatan dan kontrak ditentukan menurut tanggal kerja, termasuk untuk akses foto. */
export function buildAttendanceQuery(context, filters, { limit, cursor, summaryId } = {}) {
  const values = [context.organizationId, context.scope];
  const bind = (value) => "$" + values.push(value);
  const conditions = [
    "s.organization_id=$1",
    "($2::bigint[] IS NULL OR a.location_id=ANY($2::bigint[]))",
  ];
  if (summaryId) {
    conditions.push(`s.id=${bind(summaryId)}`);
  } else {
    conditions.push(`s.work_date BETWEEN ${bind(filters.startDate)} AND ${bind(filters.endDate)}`);
    for (const [key, column] of [
      ["locationId", "a.location_id"],
      ["organizationUnitId", "a.organization_unit_id"],
      ["positionId", "a.position_id"],
      ["employmentTypeId", "c.employment_type_id"],
    ]) {
      if (filters[key]) conditions.push(`${column}=${bind(filters[key])}`);
    }
    if (filters.search) {
      const search = bind(filters.search);
      conditions.push(`(strpos(lower(e.full_name), lower(${search}))>0
        OR strpos(lower(e.employee_no), lower(${search}))>0)`);
    }
  }
  const selected = filters?.indicator;
  const status = selected?.startsWith("status:") ? selected.slice(7) : null;
  if (status === "present") conditions.push("s.attendance_status IN ('present','late')");
  else if (status) conditions.push(`s.attendance_status=${bind(status)}`);
  const indicator = status ? null : selected;
  const indicatorCondition =
    indicator === "on_time"
      ? "indicators && ARRAY['on_time_check_in','on_time_check_out']"
      : indicator === "late_check_in"
        ? "(attendance_status='late' OR 'late_check_in'=ANY(indicators))"
        : indicator
          ? `${bind(indicator)}=ANY(indicators)`
          : "";
  const page = cursor
    ? `WHERE (work_date, id) < (${bind(cursor.workDate)}::date,${bind(cursor.id)}::bigint)`
    : "";
  const rowLimit = bind(limit || 1);
  const withIndicators = (source) => `
        SELECT cohort.*, ARRAY(
          SELECT DISTINCT signal FROM attendance_events ev
          CROSS JOIN LATERAL unnest(ARRAY[
            CASE WHEN ev.assessment_version IS NULL THEN 'unassessed'
                 WHEN ev.timing_category='on_time' THEN 'on_time_' || ev.event_type
                 WHEN ev.timing_category<>'not_applicable' THEN ev.timing_category END,
            CASE WHEN ev.geofence_status='outside' THEN 'outside_radius' END,
            CASE WHEN ev.validation_details #>> '{result,nearRadiusBoundary}'='true' THEN 'near_boundary' END,
            CASE WHEN ev.work_context IN ('holiday_work','outside_schedule') THEN ev.work_context END
          ]) AS signals(signal)
          WHERE ev.organization_id=$1 AND ev.employee_id=cohort.employee_id
            AND ev.daily_schedule_id=cohort.daily_schedule_id
            AND ev.validation_status='valid' AND ev.event_type IN ('check_in','check_out')
            AND signal IS NOT NULL ORDER BY signal
        ) || CASE WHEN attendance_status IN ('incomplete','needs_review')
                  THEN ARRAY[attendance_status::text] ELSE ARRAY[]::text[] END AS indicators
        FROM ${source} AS cohort`;
  const selectPage = (source) =>
    `SELECT * FROM ${source} ${page} ORDER BY work_date DESC,id DESC LIMIT ${rowLimit}`;
  return {
    values,
    text: `
      WITH cohort AS MATERIALIZED (
        SELECT s.id,s.employee_id,s.work_date,s.daily_schedule_id,s.attendance_status,
          s.first_check_in,s.last_check_out,s.late_minutes,s.worked_minutes,
          s.calculation_details->>'durationComplete'='true' AS duration_complete,
          s.is_manual_override,e.full_name,e.employee_no,l.name AS location_name,
          u.name AS organization_unit_name,p.name AS position_name,t.name AS employment_type_name,
          d.holiday_name,d.scheduled_start_at,d.scheduled_end_at,photo.id::text AS profile_photo_file_id
        FROM attendance_daily_summaries s
        JOIN employees e ON (e.organization_id,e.id)=(s.organization_id,s.employee_id)
          AND e.deleted_at IS NULL
        LEFT JOIN LATERAL (
          SELECT location_id,organization_unit_id,position_id
          FROM employee_assignments
          WHERE organization_id=s.organization_id AND employee_id=s.employee_id
            AND assignment_type='primary' AND effective_from<=s.work_date
            AND (effective_until IS NULL OR effective_until>=s.work_date)
          ORDER BY effective_from DESC,id DESC LIMIT 1
        ) a ON true
        LEFT JOIN LATERAL (
          SELECT employment_type_id FROM employment_contracts
          WHERE organization_id=s.organization_id AND employee_id=s.employee_id
            AND status IN ('active','expired','terminated','renewed') AND start_date<=s.work_date
            AND (end_date IS NULL OR end_date>=s.work_date)
          ORDER BY start_date DESC,id DESC LIMIT 1
        ) c ON true
        LEFT JOIN locations l ON (l.organization_id,l.id)=(s.organization_id,a.location_id)
        LEFT JOIN organization_units u ON (u.organization_id,u.id)=(s.organization_id,a.organization_unit_id)
        LEFT JOIN positions p ON (p.organization_id,p.id)=(s.organization_id,a.position_id)
        LEFT JOIN employment_types t ON (t.organization_id,t.id)=(s.organization_id,c.employment_type_id)
        LEFT JOIN employee_daily_schedules d ON (d.organization_id,d.id)=(s.organization_id,s.daily_schedule_id)
        LEFT JOIN stored_files photo ON (photo.organization_id,photo.id)=(e.organization_id,e.profile_photo_file_id)
          AND photo.employee_id=e.id AND photo.category='employee_photo'
          AND photo.deleted_at IS NULL AND photo.lifecycle_status='active'
        WHERE ${conditions.join(" AND ")}
      ), ${
        indicatorCondition
          ? `
        matched AS MATERIALIZED (${withIndicators("cohort")}),
        filtered AS MATERIALIZED (SELECT * FROM matched WHERE ${indicatorCondition}),
        page_rows AS (${selectPage("filtered")})
      `
          : `
        selected AS (${selectPage("cohort")}),
        page_rows AS (${withIndicators("selected")})
      `
      }
      SELECT (SELECT count(*)::int FROM ${indicatorCondition ? "filtered" : "cohort"}) AS total,
        COALESCE(json_agg(to_jsonb(page_rows) - 'daily_schedule_id' - 'employee_id'
          - 'scheduled_start_at' - 'scheduled_end_at'
          || jsonb_build_object('id',id::text,'employee_id',employee_id::text,
             'daily_schedule_id',daily_schedule_id::text,'schedule',COALESCE(schedule.sessions,
               CASE WHEN scheduled_start_at IS NOT NULL AND scheduled_end_at IS NOT NULL
                 THEN jsonb_build_array(jsonb_build_object('starts_at',scheduled_start_at,'ends_at',scheduled_end_at))
                 ELSE '[]'::jsonb END))
          ORDER BY work_date DESC,id DESC),'[]'::json) AS rows
      FROM page_rows
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(jsonb_build_object('starts_at',starts_at,'ends_at',ends_at) ORDER BY session_no) AS sessions
        FROM work_schedule_sessions
        WHERE organization_id=$1 AND daily_schedule_id=page_rows.daily_schedule_id
          AND employee_id=page_rows.employee_id
      ) schedule ON true
    `,
  };
}
