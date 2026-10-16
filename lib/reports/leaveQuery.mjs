/** Satu cohort berizin menyatukan kartu, grafik, rekap, saldo, rincian dan ekspor. */
export function buildLeaveReportQuery(
  filters,
  context,
  limit,
  cursor = null,
  includeDetails = false,
) {
  const values = [
    context.organizationId,
    context.today,
    context.scope,
    `${filters.year}-01-01`,
    `${filters.year + 1}-01-01`,
    context.organization.timezone,
    `%${filters.search.replace(/[\\%_]/g, "\\$&")}%`,
    filters.locationId || null,
    filters.organizationUnitId || null,
    filters.employeeId || null,
    filters.leaveTypeId || null,
    limit,
  ];
  const bind = (value) => {
    values.push(value);
    return `$${values.length}`;
  };
  const details = filters.view === "details";
  const after = cursor
    ? details
      ? `AND id<${bind(cursor.id)}::bigint`
      : `AND (employee_id,leave_type_id)>(${bind(cursor.employeeId)}::bigint,${bind(cursor.leaveTypeId)}::bigint)`
    : "";
  const text = `WITH employees_scoped AS (
    SELECT e.id,e.organization_id,e.employee_no,e.full_name,photo.id::text AS profile_photo_file_id,a.location_id,a.organization_unit_id,
      l.name AS location_name,u.name AS organization_unit_name
    FROM employees e
    LEFT JOIN stored_files photo ON photo.organization_id=e.organization_id AND photo.employee_id=e.id
      AND photo.id=e.profile_photo_file_id AND photo.deleted_at IS NULL AND photo.lifecycle_status='active'
      AND photo.category='employee_photo'
    LEFT JOIN LATERAL (
      SELECT location_id,organization_unit_id FROM employee_assignments
      WHERE organization_id=e.organization_id AND employee_id=e.id AND assignment_type='primary'
        AND effective_from<=$2::date AND (effective_until IS NULL OR effective_until>=$2::date)
      ORDER BY effective_from DESC,id DESC LIMIT 1
    ) a ON true
    LEFT JOIN locations l ON l.organization_id=e.organization_id AND l.id=a.location_id
    LEFT JOIN organization_units u ON u.organization_id=e.organization_id AND u.id=a.organization_unit_id
    WHERE e.organization_id=$1 AND e.deleted_at IS NULL
      AND ($3::bigint[] IS NULL OR a.location_id=ANY($3::bigint[]))
      AND ($7='%%' OR e.full_name ILIKE $7 ESCAPE '\\' OR e.employee_no ILIKE $7 ESCAPE '\\')
      AND ($8::bigint IS NULL OR a.location_id=$8) AND ($9::bigint IS NULL OR a.organization_unit_id=$9)
      AND ($10::bigint IS NULL OR e.id=$10)
  ), requests AS (
    SELECT r.id,r.employee_id,r.leave_type_id,r.request_no,r.status,r.requested_units,t.unit,
      (r.start_at AT TIME ZONE $6)::date AS start_date,(r.end_at AT TIME ZONE $6)::date AS end_date
    FROM leave_requests r JOIN employees_scoped e ON e.id=r.employee_id AND e.organization_id=r.organization_id
    JOIN leave_types t ON t.organization_id=r.organization_id AND t.id=r.leave_type_id
    WHERE r.organization_id=$1 AND r.status IN ('approved','cancelled')
      AND (r.start_at AT TIME ZONE $6)::date >= $4::date AND (r.start_at AT TIME ZONE $6)::date < $5::date
      AND ($11::bigint IS NULL OR r.leave_type_id=$11)
  ), balances AS (
    SELECT entitlement.employee_id,entitlement.leave_type_id,
      COALESCE(sum(ledger.units) FILTER(WHERE ledger.transaction_type IN ('grant','carryover','adjustment')),0) AS allocated,
      -COALESCE(sum(ledger.units) FILTER(WHERE ledger.transaction_type IN ('usage','restoration')),0) AS used,
      COALESCE(sum(ledger.units),0) AS balance
    FROM leave_entitlements entitlement
    JOIN employees_scoped e ON e.organization_id=entitlement.organization_id AND e.id=entitlement.employee_id
    LEFT JOIN leave_balance_transactions ledger ON ledger.organization_id=entitlement.organization_id AND ledger.entitlement_id=entitlement.id
    WHERE entitlement.organization_id=$1 AND entitlement.period_start >= $4::date AND entitlement.period_start < $5::date
      AND ($11::bigint IS NULL OR entitlement.leave_type_id=$11)
    GROUP BY entitlement.employee_id,entitlement.leave_type_id
  ), request_counts AS (
    SELECT employee_id,leave_type_id,count(*) FILTER(WHERE status='approved')::int AS approved,
      count(*) FILTER(WHERE status='cancelled')::int AS cancelled,
      COALESCE(sum(requested_units) FILTER(WHERE status='approved'),0) AS duration
    FROM requests GROUP BY employee_id,leave_type_id
  ), pairs AS (
    SELECT employee_id,leave_type_id FROM request_counts UNION SELECT employee_id,leave_type_id FROM balances
  ), recap AS (
    SELECT e.id::text||':'||t.id::text AS id,e.id AS employee_id,t.id AS leave_type_id,
      e.organization_id::text,e.employee_no,e.full_name,e.profile_photo_file_id,e.location_name,e.organization_unit_name,
      t.name AS leave_type_name,t.unit,t.uses_balance,
      COALESCE(c.approved,0) AS approved,COALESCE(c.cancelled,0) AS cancelled,COALESCE(c.duration,0) AS duration,
      b.allocated,b.used,b.balance
    FROM pairs p JOIN employees_scoped e ON e.id=p.employee_id
    JOIN leave_types t ON t.organization_id=e.organization_id AND t.id=p.leave_type_id
    LEFT JOIN request_counts c ON c.employee_id=p.employee_id AND c.leave_type_id=p.leave_type_id
    LEFT JOIN balances b ON b.employee_id=p.employee_id AND b.leave_type_id=p.leave_type_id
  ), types AS (
    SELECT t.id::text,t.name,t.unit,count(r.id) FILTER(WHERE r.status='approved')::int AS approved,
      count(r.id) FILTER(WHERE r.status='cancelled')::int AS cancelled,
      COALESCE(sum(r.requested_units) FILTER(WHERE r.status='approved'),0) AS duration
    FROM leave_types t LEFT JOIN requests r ON r.leave_type_id=t.id
    WHERE t.organization_id=$1 AND ($11::bigint IS NULL OR t.id=$11)
      AND (t.is_active OR EXISTS(SELECT 1 FROM requests WHERE leave_type_id=t.id))
    GROUP BY t.id ORDER BY t.name,t.id
  ), months AS (
    SELECT month,count(r.id) FILTER(WHERE r.status='approved')::int AS approved,
      count(r.id) FILTER(WHERE r.status='cancelled')::int AS cancelled
    FROM generate_series(1,12) month LEFT JOIN requests r ON extract(month FROM r.start_date)=month
    GROUP BY month ORDER BY month
  ), page AS (
    ${
      details
        ? `SELECT id::text,employee_id::text,leave_type_id::text,request_no,status,requested_units,unit,start_date::text,end_date::text
        FROM requests WHERE true ${after} ORDER BY requests.id DESC LIMIT $12`
        : `SELECT id,employee_id::text,leave_type_id::text,organization_id,employee_no,full_name,profile_photo_file_id,
        location_name,organization_unit_name,leave_type_name,unit,uses_balance,approved,cancelled,duration,allocated,used,balance
        FROM recap WHERE true ${after} ORDER BY recap.employee_id,recap.leave_type_id LIMIT $12`
    }
  ) SELECT
    ${
      includeDetails
        ? `COALESCE((SELECT jsonb_agg(detail) FROM (
      SELECT r.id::text,r.employee_id::text,r.leave_type_id::text,e.employee_no,e.full_name,
        e.location_name,e.organization_unit_name,t.name AS leave_type_name,r.request_no,r.status,
        r.start_date::text,r.end_date::text,r.requested_units,r.unit
      FROM requests r JOIN employees_scoped e ON e.id=r.employee_id
      JOIN leave_types t ON t.organization_id=e.organization_id AND t.id=r.leave_type_id
      ORDER BY e.id,t.id,r.id DESC LIMIT 5001
    ) detail),'[]'::jsonb) AS detail_rows,
    (SELECT count(*)::int FROM requests) AS detail_total,`
        : ""
    }
    (SELECT count(*)::int FROM ${details ? "requests" : "recap"}) AS total,
    (SELECT jsonb_build_object('approved',count(*) FILTER(WHERE status='approved'),
      'cancelled',count(*) FILTER(WHERE status='cancelled'),
      'employees',count(DISTINCT employee_id) FILTER(WHERE status='approved'),
      'days',COALESCE(sum(requested_units) FILTER(WHERE status='approved' AND unit='day'),0),
      'hours',COALESCE(sum(requested_units) FILTER(WHERE status='approved' AND unit='hour'),0)) FROM requests) AS summary,
    COALESCE((SELECT jsonb_agg(types) FROM types),'[]'::jsonb) AS types,
    (SELECT jsonb_agg(months) FROM months) AS months,
    COALESCE((SELECT jsonb_agg(page ${details ? "ORDER BY page.id::bigint DESC" : "ORDER BY page.employee_id::bigint,page.leave_type_id::bigint"}) FROM page),'[]'::jsonb) AS rows,
    COALESCE((SELECT jsonb_agg(DISTINCT jsonb_build_object('value',location_id::text,'label',location_name))
      FROM employees_scoped WHERE location_id IS NOT NULL),'[]'::jsonb) AS locations,
    COALESCE((SELECT jsonb_agg(DISTINCT jsonb_build_object('value',organization_unit_id::text,'label',organization_unit_name))
      FROM employees_scoped WHERE organization_unit_id IS NOT NULL),'[]'::jsonb) AS units,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('value',id::text,'label',name) ORDER BY name,id)
      FROM leave_types WHERE organization_id=$1 AND (is_active OR EXISTS(SELECT 1 FROM requests WHERE leave_type_id=leave_types.id))),'[]'::jsonb) AS type_options`;
  return { text, values };
}
