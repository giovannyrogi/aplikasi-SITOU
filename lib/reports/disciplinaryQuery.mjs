/** Query mengelompokkan tindakan resmi yang cocok menjadi satu baris per pegawai. */
export function buildDisciplinaryReportQuery(
  filters,
  organizationId,
  scope,
  today,
  limit,
  cursor = null,
) {
  const params = [organizationId, today, scope];
  const effectiveStatus = `CASE WHEN action.status='active' AND action.effective_until IS NOT NULL
    AND action.effective_until<$2::date THEN 'expired' ELSE action.status END`;
  const bind = (value) => {
    params.push(value);
    return `$${params.length}`;
  };
  const conditions = ["action.status<>'draft'", "employee.deleted_at IS NULL"];
  for (const [key, column] of [
    ["locationId", "assignment.location_id"],
    ["organizationUnitId", "assignment.organization_unit_id"],
    ["positionId", "assignment.position_id"],
  ]) {
    if (filters[key]) conditions.push(`${column}=${bind(filters[key])}::bigint`);
  }
  if (filters.employmentStatus !== "all")
    conditions.push(`employee.employment_status=${bind(filters.employmentStatus)}`);
  if (filters.severity !== "all")
    conditions.push(`discipline_case.severity=${bind(filters.severity)}`);
  if (filters.actionTypeId)
    conditions.push(`action.action_type_id=${bind(filters.actionTypeId)}::bigint`);
  if (filters.actionStatus !== "all")
    conditions.push(`${effectiveStatus}=${bind(filters.actionStatus)}`);
  if (filters.startDate) {
    conditions.push(`action.issued_date>=${bind(filters.startDate)}::date`);
    conditions.push(`action.issued_date<=${bind(filters.endDate)}::date`);
  }
  if (filters.search) {
    const pattern = `%${filters.search.replace(/[\\%_]/g, "\\$&")}%`;
    const search = bind(pattern);
    conditions.push(`(employee.full_name ILIKE ${search} ESCAPE '\\' OR employee.employee_no ILIKE ${search} ESCAPE '\\'
      OR discipline_case.case_no ILIKE ${search} ESCAPE '\\' OR action.letter_no ILIKE ${search} ESCAPE '\\')`);
  }
  const after = cursor
    ? `AND (latest_issued_date,employee_id) < (${bind(cursor.date)}::date,${bind(cursor.employeeId)}::bigint)`
    : "";
  const take = bind(limit);

  const text = `WITH matched AS (
    SELECT employee.id AS employee_id,employee.organization_id,photo.id AS profile_photo_file_id,
      employee.employee_no,employee.full_name,employee.employment_status,
      assignment.location_id,assignment.organization_unit_id,assignment.position_id,
      location.name AS location_name,unit.name AS unit_name,position.name AS position_name,
      action.id AS action_id,action.action_type_id,action.action_name_snapshot,
      action.requires_document_snapshot,${effectiveStatus} AS action_status,action.letter_no,
      action.issued_date,action.effective_from,action.effective_until,action.direct_escalation,
      action.document_file_id,action.issued_by_user_id,issuer.display_name AS issued_by_name,
      discipline_case.id AS discipline_case_id,discipline_case.case_no,discipline_case.severity,
      discipline_case.incident_date,
      count(*) OVER (PARTITION BY employee.id)::int AS matched_action_count,
      row_number() OVER (PARTITION BY employee.id ORDER BY action.issued_date DESC,action.id DESC) AS match_rank
    FROM disciplinary_actions action
    JOIN discipline_cases discipline_case
      ON discipline_case.organization_id=action.organization_id
      AND discipline_case.id=action.discipline_case_id
    JOIN employees employee
      ON employee.organization_id=action.organization_id AND employee.id=action.employee_id
    JOIN v_user_identity issuer ON issuer.user_id=action.issued_by_user_id
    LEFT JOIN stored_files photo ON photo.organization_id=employee.organization_id
      AND photo.id=employee.profile_photo_file_id AND photo.deleted_at IS NULL
    LEFT JOIN LATERAL (
      SELECT current_assignment.location_id,current_assignment.organization_unit_id,current_assignment.position_id
      FROM employee_assignments current_assignment
      WHERE current_assignment.organization_id=employee.organization_id
        AND current_assignment.employee_id=employee.id
        AND current_assignment.assignment_type='primary'
        AND current_assignment.effective_from<=$2::date
        AND (current_assignment.effective_until IS NULL OR current_assignment.effective_until>=$2::date)
      ORDER BY current_assignment.effective_from DESC,current_assignment.id DESC LIMIT 1
    ) assignment ON true
    LEFT JOIN locations location ON location.organization_id=employee.organization_id
      AND location.id=assignment.location_id
    LEFT JOIN organization_units unit ON unit.organization_id=employee.organization_id
      AND unit.id=assignment.organization_unit_id
    LEFT JOIN positions position ON position.organization_id=employee.organization_id
      AND position.id=assignment.position_id
    WHERE action.organization_id=$1
      AND ($3::bigint[] IS NULL OR assignment.location_id=ANY($3::bigint[]))
      AND ${conditions.join(" AND ")}
  ), official_counts AS (
    SELECT official.employee_id,count(*)::int AS total_official_actions,
      count(*) FILTER (WHERE
        (official.status='active' AND (official.effective_until IS NULL OR official.effective_until>=$2::date))
        OR official.status='appealed')::int AS active_or_appealed_count
    FROM disciplinary_actions official
    WHERE official.organization_id=$1 AND official.status<>'draft'
    GROUP BY official.employee_id
  ), latest AS (
    SELECT matched.*,matched.issued_date AS latest_issued_date,
      official_counts.total_official_actions,official_counts.active_or_appealed_count
    FROM matched JOIN official_counts USING(employee_id) WHERE matched.match_rank=1
  ), page AS (
    SELECT employee_id::text AS id,employee_id::text,organization_id::text,
      profile_photo_file_id::text,employee_no,full_name,employment_status,
      location_id::text,organization_unit_id::text,position_id::text,
      location_name,unit_name,position_name,action_id::text,action_type_id::text,
      action_name_snapshot,requires_document_snapshot,action_status,
      letter_no,issued_date::text,effective_from::text,effective_until::text,direct_escalation,
      document_file_id::text,issued_by_user_id::text,issued_by_name,
      discipline_case_id::text,case_no,severity,incident_date::text,
      matched_action_count,total_official_actions,active_or_appealed_count,latest_issued_date::text
    FROM latest WHERE true ${after}
    ORDER BY latest_issued_date DESC,employee_id DESC LIMIT ${take}
  )
  SELECT (SELECT count(*)::int FROM latest) AS total,
    COALESCE((SELECT sum(matched_action_count)::int FROM latest),0) AS total_matched_actions,
    COALESCE((SELECT sum(active_or_appealed_count)::int FROM latest),0) AS total_active_or_appealed,
    COALESCE((SELECT jsonb_agg(page ORDER BY page.latest_issued_date DESC,page.employee_id::bigint DESC) FROM page),'[]'::jsonb) AS rows`;
  return { text, values: params };
}
