/** Query ulang tahun berbasis kalender agar filter 30 hari terjadi di PostgreSQL. */
export const BIRTHDAY_SUMMARY_SQL = `WITH calendar AS (
  SELECT day::date AS celebration_date,
    extract(month FROM day)::int AS birth_month,
    extract(day FROM day)::int AS birth_day,
    (day::date-$2::date)::int AS days_until
  FROM generate_series($2::date,$2::date+30,interval '1 day') AS value(day)
  UNION ALL
  SELECT day::date,2,29,(day::date-$2::date)::int
  FROM generate_series($2::date,$2::date+30,interval '1 day') AS value(day)
  WHERE extract(month FROM day)=2 AND extract(day FROM day)=28
    AND extract(day FROM (date_trunc('month',day)+interval '1 month - 1 day'))=28
), scoped AS (
  SELECT employee.*
  FROM employees employee
  WHERE employee.organization_id=$1 AND employee.deleted_at IS NULL
    AND employee.employment_status IN ('active','probation')
    AND employee.birth_date IS NOT NULL
    AND ($3::bigint[] IS NULL OR EXISTS (
      SELECT 1 FROM employee_assignments scoped_assignment
      WHERE scoped_assignment.organization_id=employee.organization_id
        AND scoped_assignment.employee_id=employee.id
        AND scoped_assignment.assignment_type='primary'
        AND scoped_assignment.effective_from<=$2::date
        AND (scoped_assignment.effective_until IS NULL
          OR scoped_assignment.effective_until>=$2::date)
        AND scoped_assignment.location_id=ANY($3::bigint[])
    ))
)
SELECT scoped.id::text AS employee_id,scoped.organization_id::text AS organization_id,
  scoped.full_name,scoped.preferred_name,scoped.profile_photo_file_id::text,
  current_assignment.position_name,current_assignment.location_name,
  calendar.celebration_date::text,calendar.days_until,
  (extract(year FROM calendar.celebration_date)::int
    - extract(year FROM scoped.birth_date)::int) AS age_turning
FROM scoped
JOIN calendar
  ON calendar.birth_month=extract(month FROM scoped.birth_date)::int
 AND calendar.birth_day=extract(day FROM scoped.birth_date)::int
LEFT JOIN LATERAL (
  SELECT position.name AS position_name,location.name AS location_name
  FROM employee_assignments assignment
  LEFT JOIN positions position ON position.organization_id=assignment.organization_id
    AND position.id=assignment.position_id
  LEFT JOIN locations location ON location.organization_id=assignment.organization_id
    AND location.id=assignment.location_id
  WHERE assignment.organization_id=scoped.organization_id
    AND assignment.employee_id=scoped.id AND assignment.assignment_type='primary'
    AND assignment.effective_from<=$2::date
    AND (assignment.effective_until IS NULL OR assignment.effective_until>=$2::date)
  ORDER BY assignment.effective_from DESC,assignment.id DESC LIMIT 1
) current_assignment ON true
ORDER BY calendar.days_until,scoped.full_name,scoped.id`;
