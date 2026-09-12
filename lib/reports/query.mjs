import { RETIREMENT_AGE } from "./policy.mjs";

/** Query laporan dibangun dengan parameter; daftar, total, dan Excel membaca snapshot yang sama. */
export function buildReportQuery(
  kind,
  filters,
  organizationId,
  scope,
  today,
  limit,
  cursor = null,
) {
  const params = [organizationId, today, scope];
  const bind = (value) => {
    params.push(value);
    return `$${params.length}`;
  };
  const retirement = kind === "retirements";
  const conditions = [];
  for (const [key, column] of [
    ["locationId", "location_id"],
    ["organizationUnitId", "organization_unit_id"],
    ["positionId", "position_id"],
    ["employmentTypeId", "employment_type_id"],
  ]) {
    if (filters[key]) conditions.push(`${column}=${bind(filters[key])}::bigint`);
  }
  if (filters.search)
    conditions.push(
      `(full_name ILIKE ${bind(`%${filters.search.replace(/[\\%_]/g, "\\$&")}%`)} OR employee_no ILIKE $${params.length})`,
    );
  if (filters.group === "invalid") conditions.push("due_date IS NULL");
  else {
    conditions.push("due_date IS NOT NULL");
    if (filters.group === "upcoming") conditions.push("due_date >= $2::date");
    if (filters.group === "overdue") conditions.push("due_date < $2::date");
    if (filters.startDate) conditions.push(`due_date>=${bind(filters.startDate)}::date`);
    if (filters.endDate) conditions.push(`due_date<=${bind(filters.endDate)}::date`);
  }
  if (!retirement && filters.successor !== "all")
    conditions.push(`successor_id IS ${filters.successor === "yes" ? "NOT " : ""}NULL`);
  const after = cursor
    ? `WHERE (COALESCE(due_date,'9999-12-31'::date),id) > (${bind(cursor.date)}::date,${bind(cursor.id)}::bigint)`
    : "";
  const take = bind(limit);
  const text = `WITH base AS (
    SELECT e.id AS employee_id,e.organization_id,photo.id AS profile_photo_file_id,e.employee_no,e.full_name,e.birth_date,e.joined_date,e.employment_status,
      a.location_id,a.organization_unit_id,a.position_id,l.name AS location_name,u.name AS unit_name,p.name AS position_name,
      ${
        retirement
          ? `e.id,CASE WHEN e.birth_date IS NOT NULL AND isfinite(e.birth_date) AND e.birth_date<=$2::date
        THEN (e.birth_date+make_interval(years => ${RETIREMENT_AGE}))::date END AS due_date,
        c.employment_type_id,t.name AS employment_type_name,NULL::text AS contract_no,NULL::date AS start_date,
        NULL::bigint AS successor_id,NULL::date AS successor_start_date`
          : `c.id,c.end_date AS due_date,c.employment_type_id,t.name AS employment_type_name,c.contract_no,c.start_date,
        successor.id AS successor_id,successor.start_date AS successor_start_date`
      }
    FROM employees e
    LEFT JOIN stored_files photo ON photo.organization_id=e.organization_id
      AND photo.id=e.profile_photo_file_id AND photo.deleted_at IS NULL
    LEFT JOIN LATERAL (
      SELECT location_id,organization_unit_id,position_id FROM employee_assignments
      WHERE organization_id=e.organization_id AND employee_id=e.id AND assignment_type='primary'
        AND effective_from<=$2::date AND (effective_until IS NULL OR effective_until>=$2::date)
      ORDER BY effective_from DESC,id DESC LIMIT 1
    ) a ON true
    LEFT JOIN locations l ON l.organization_id=e.organization_id AND l.id=a.location_id
    LEFT JOIN organization_units u ON u.organization_id=e.organization_id AND u.id=a.organization_unit_id
    LEFT JOIN positions p ON p.organization_id=e.organization_id AND p.id=a.position_id
    ${
      retirement
        ? `LEFT JOIN LATERAL (
      SELECT employment_type_id FROM employment_contracts
      WHERE organization_id=e.organization_id AND employee_id=e.id AND status IN ('active','renewed')
        AND start_date<=$2::date AND (end_date IS NULL OR end_date>=$2::date)
      ORDER BY start_date DESC,id DESC LIMIT 1
    ) c ON true`
        : `JOIN employment_contracts c ON c.organization_id=e.organization_id AND c.employee_id=e.id
      AND c.status IN ('active','renewed','expired') AND c.end_date IS NOT NULL AND isfinite(c.end_date)
      AND c.start_date<=$2::date
    LEFT JOIN LATERAL (
      SELECT id,start_date FROM employment_contracts n
      WHERE n.organization_id=c.organization_id AND n.employee_id=c.employee_id
        AND n.status IN ('active','renewed','expired') AND n.start_date>c.start_date
      ORDER BY n.start_date,n.id LIMIT 1
    ) successor ON true`
    }
    LEFT JOIN employment_types t ON t.organization_id=e.organization_id AND t.id=c.employment_type_id
    WHERE e.organization_id=$1 AND e.deleted_at IS NULL AND e.employment_status IN ('active','probation','suspended')
      AND ($3::bigint[] IS NULL OR a.location_id=ANY($3::bigint[]))
      ${retirement ? "" : "AND NOT (c.end_date<$2::date AND successor.id IS NOT NULL)"}
  ), filtered AS (SELECT base.* FROM base WHERE ${conditions.join(" AND ") || "true"}),
  page AS (SELECT id::text,employee_id::text,organization_id::text,profile_photo_file_id::text,employee_no,full_name,location_name,unit_name,position_name,
      employment_type_name,contract_no,start_date::text,due_date::text,
      CASE WHEN isfinite(birth_date) THEN birth_date::text END AS birth_date,
      CASE WHEN isfinite(joined_date) THEN joined_date::text END AS joined_date,
      CASE WHEN birth_date<=$2::date AND isfinite(birth_date) THEN extract(year FROM age($2::date,birth_date))::int END AS age,
      employment_status,successor_id::text,successor_start_date::text,(due_date-$2::date)::int AS days_remaining
    FROM filtered ${after} ORDER BY filtered.due_date ASC NULLS LAST,filtered.id ASC LIMIT ${take})
  SELECT (SELECT count(*)::int FROM filtered) AS total,
    ${cursor ? `(SELECT count(*)::int FROM filtered ${after.replace(" > ", " <= ")})` : "0"} AS row_offset,
    (SELECT count(DISTINCT employee_id)::int FROM filtered) AS employee_count,
    COALESCE((SELECT jsonb_agg(page ORDER BY page.due_date ASC NULLS LAST,page.id::bigint ASC) FROM page),'[]'::jsonb) AS rows`;
  return { text, values: params };
}
