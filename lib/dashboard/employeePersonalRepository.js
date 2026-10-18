import pool from "@/lib/dbConfig";

/** Profil selalu dipetakan dari sesi; tidak menerima target pegawai dari browser. */
export async function readEmployeePersonalSummary(actor, allowed, database = pool) {
  const { rows } = await database.query(
    `WITH self AS (
    SELECT e.id,e.organization_id,e.gender,o.timezone,(now() AT TIME ZONE o.timezone)::date AS today
    FROM employees e JOIN organizations o ON o.id=e.organization_id
    WHERE e.organization_id=$1 AND e.user_id=$2 AND e.deleted_at IS NULL
  ), requests AS (
    SELECT r.id,r.leave_type_id::text,r.request_no,r.status,t.name,t.unit,r.requested_units,r.submission_source,
      to_char(r.start_at AT TIME ZONE s.timezone,'YYYY-MM-DD') AS start_date,
      to_char(r.end_at AT TIME ZONE s.timezone,'YYYY-MM-DD') AS end_date,
      extract(year FROM r.start_at AT TIME ZONE s.timezone)=extract(year FROM s.today) AS this_year
    FROM self s JOIN leave_requests r ON r.organization_id=s.organization_id AND r.employee_id=s.id
    JOIN leave_types t ON t.organization_id=r.organization_id AND t.id=r.leave_type_id
    WHERE $3::boolean AND r.status<>'draft'
  ), balances AS (
    SELECT t.id::text,t.name,t.unit,t.uses_balance,t.is_active,t.annual_allowance,
      CASE WHEN count(e.id)>0 THEN COALESCE(sum(b.units) FILTER(WHERE b.transaction_type IN ('grant','carryover','adjustment')),0) END AS allocated,
      CASE WHEN count(e.id)>0 THEN -COALESCE(sum(b.units) FILTER(WHERE b.transaction_type IN ('usage','restoration')),0) END AS used,
      CASE WHEN count(e.id)>0 THEN COALESCE(sum(b.units),0) END AS balance
    FROM self s JOIN leave_types t ON t.organization_id=s.organization_id
    LEFT JOIN leave_entitlements e ON e.organization_id=s.organization_id AND e.employee_id=s.id AND e.leave_type_id=t.id
      AND e.period_start>=date_trunc('year',s.today)::date AND e.period_start<(date_trunc('year',s.today)+interval '1 year')::date
    LEFT JOIN leave_balance_transactions b ON b.organization_id=e.organization_id AND b.entitlement_id=e.id
    WHERE $3::boolean AND t.uses_balance AND (t.is_active OR e.id IS NOT NULL)
      AND (t.eligible_gender='all' OR t.eligible_gender=s.gender)
    GROUP BY t.id ORDER BY t.name,t.id
  ), actions AS (
    SELECT a.id,a.discipline_case_id::text AS case_id,a.action_name_snapshot AS name,to_char(a.issued_date,'YYYY-MM-DD') AS issued_date,
      to_char(a.effective_from,'YYYY-MM-DD') AS start_date,to_char(a.effective_until,'YYYY-MM-DD') AS end_date,
      CASE WHEN a.status='active' AND a.effective_until<s.today THEN 'expired'
        WHEN a.status='active' AND a.effective_from>s.today THEN 'scheduled' ELSE a.status END AS status
    FROM self s JOIN disciplinary_actions a ON a.organization_id=s.organization_id AND a.employee_id=s.id
    WHERE $4::boolean AND a.status<>'draft'
  ) SELECT
    (SELECT jsonb_build_object('pending',count(*) FILTER(WHERE status='submitted'),
      'approved',count(*) FILTER(WHERE status='approved' AND this_year),
      'total',count(*)) FROM requests) AS leave_counts,
    COALESCE((SELECT jsonb_agg(balances) FROM balances),'[]'::jsonb) AS balances,
    COALESCE((SELECT jsonb_agg(recent ORDER BY recent.id::bigint DESC) FROM
      (SELECT id::text,leave_type_id,request_no,status,name,unit,requested_units,submission_source,start_date,end_date FROM requests ORDER BY id DESC LIMIT 5) recent),'[]'::jsonb) AS requests,
    (SELECT count(*)::int FROM actions WHERE status='active') AS active_sanctions,
    COALESCE((SELECT jsonb_agg(recent ORDER BY recent.issued_date DESC,recent.id::bigint DESC) FROM
      (SELECT id::text,case_id,name,issued_date,start_date,end_date,status FROM actions ORDER BY issued_date DESC,id DESC LIMIT 5) recent),'[]'::jsonb) AS sanctions`,
    [actor.organization_id, actor.id, allowed[0], allowed[1]],
  );
  const row = rows[0];
  return {
    ...(allowed[0]
      ? { leave: { counts: row.leave_counts, balances: row.balances, recent: row.requests } }
      : {}),
    ...(allowed[1] ? { discipline: { active: row.active_sanctions, recent: row.sanctions } } : {}),
  };
}
