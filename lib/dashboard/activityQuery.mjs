/** Feed organisasi mengambil target nyata, tanpa payload audit atau aktivitas draft internal. */
export const ORGANIZATION_ACTIVITY_SQL = `
  SELECT audit.id::text,audit.action,audit.entity_type,audit.occurred_at,
    '@'||actor.username AS actor_name,
    employee.full_name AS employee_name,employee.employee_no,
    target_account.username AS target_username,
    CASE WHEN audit.entity_type IN ('location','organization_unit','organization_unit_type',
      'position','employment_type','leave_type','disciplinary_action_type')
      THEN COALESCE(audit.after_data->>'name',audit.before_data->>'name') END AS target_name,
    CASE WHEN audit.entity_type='report' THEN audit.entity_id END AS report_kind,
    CASE WHEN audit.entity_type='employee_export' THEN audit.after_data->>'employeeCount' END AS employee_count,
    CASE WHEN audit.entity_type='employee_import_batch' THEN audit.after_data->>'committedEmployees' END AS import_count,
    organization.timezone
  FROM audit_logs audit
  JOIN organizations organization ON organization.id=audit.organization_id
  JOIN users actor ON actor.id=audit.actor_user_id
  LEFT JOIN users target_account ON audit.entity_type='user' AND target_account.id::text=audit.entity_id
    AND EXISTS (SELECT 1 FROM user_organization_roles target_membership
      WHERE target_membership.user_id=target_account.id
        AND target_membership.organization_id=audit.organization_id)
  LEFT JOIN employment_contracts contract ON audit.entity_type='employment_contract'
    AND contract.organization_id=audit.organization_id AND contract.id::text=audit.entity_id
  LEFT JOIN employee_assignments assignment ON audit.entity_type='employee_assignment'
    AND assignment.organization_id=audit.organization_id AND assignment.id::text=audit.entity_id
  LEFT JOIN leave_requests leave_request ON audit.entity_type='leave_request'
    AND leave_request.organization_id=audit.organization_id AND leave_request.id::text=audit.entity_id
  LEFT JOIN leave_entitlements entitlement ON audit.entity_type='leave_entitlement'
    AND entitlement.organization_id=audit.organization_id AND entitlement.id::text=audit.entity_id
  LEFT JOIN discipline_cases case_data ON audit.entity_type='discipline_case'
    AND case_data.organization_id=audit.organization_id AND case_data.id::text=audit.entity_id
  LEFT JOIN disciplinary_actions action_data ON audit.entity_type='disciplinary_action'
    AND action_data.organization_id=audit.organization_id AND action_data.id::text=audit.entity_id
  LEFT JOIN employees employee ON employee.organization_id=audit.organization_id
    AND employee.id::text=COALESCE(
      CASE WHEN audit.entity_type='employee' THEN audit.entity_id END,
      contract.employee_id::text,assignment.employee_id::text,leave_request.employee_id::text,
      case_data.employee_id::text,action_data.employee_id::text,entitlement.employee_id::text)
  WHERE audit.organization_id=$1
    AND audit.action=ANY($3::text[])
    AND EXISTS (
      SELECT 1 FROM user_organization_roles membership
      JOIN roles actor_role ON actor_role.id=membership.role_id
      WHERE actor_role.code='hrd' AND membership.user_id=audit.actor_user_id
        AND membership.organization_id=audit.organization_id
        AND membership.active_from<=audit.occurred_at
        AND (membership.active_until IS NULL OR membership.active_until>audit.occurred_at))
    AND NOT EXISTS (
      SELECT 1 FROM user_organization_roles platform_role
      JOIN roles role ON role.id=platform_role.role_id
      WHERE platform_role.user_id=audit.actor_user_id AND role.code='superadmin')
    AND (audit.action<>'login.success' OR audit.after_data->>'role_code'='hrd')
    AND audit.action NOT LIKE 'employee_draft.%'
    AND audit.action NOT LIKE 'private_file.%'
    AND audit.action NOT LIKE 'storage_maintenance.%'
    AND audit.action NOT LIKE 'auth.%'
    AND audit.entity_type IN ('employee','employment_contract','employee_assignment',
      'leave_request','leave_entitlement','discipline_case','disciplinary_action','user','location','organization_unit',
      'organization_unit_type','position','employment_type','leave_type',
      'disciplinary_action_type','organization_retirement_policy','employee_import_batch','report','employee_export')
    AND (audit.entity_type<>'disciplinary_action' OR action_data.status<>'draft')
    AND (audit.entity_type<>'discipline_case' OR EXISTS (
      SELECT 1 FROM disciplinary_actions official_action
      WHERE official_action.organization_id=case_data.organization_id
        AND official_action.discipline_case_id=case_data.id AND official_action.status<>'draft'))
    AND ($2::bigint[] IS NULL OR (
      employee.id IS NOT NULL AND EXISTS (
        SELECT 1 FROM employee_assignments scoped_assignment
        WHERE scoped_assignment.organization_id=employee.organization_id
          AND scoped_assignment.employee_id=employee.id AND scoped_assignment.assignment_type='primary'
          AND scoped_assignment.effective_from<=(now() AT TIME ZONE organization.timezone)::date
          AND (scoped_assignment.effective_until IS NULL
            OR scoped_assignment.effective_until>=(now() AT TIME ZONE organization.timezone)::date)
          AND scoped_assignment.location_id=ANY($2::bigint[]))))
  ORDER BY audit.occurred_at DESC,audit.id DESC LIMIT 5
`;

/** Filter menu/akun sama persis pada lima aktivitas terbaru dan riwayat keyset. */
export function buildOrganizationActivitySql({ paginated = false } = {}) {
  let sql = ORGANIZATION_ACTIVITY_SQL.replace(
    "ORDER BY audit.occurred_at",
    `AND (audit.entity_type<>'report' OR audit.entity_id=ANY($4::text[]))
    AND ($5::boolean OR audit.entity_type<>'user' OR EXISTS (
      SELECT 1 FROM user_organization_roles member JOIN roles role ON role.id=member.role_id
      WHERE member.organization_id=audit.organization_id AND member.user_id=target_account.id
        AND role.code='employee')) ORDER BY audit.occurred_at`,
  );
  if (paginated) {
    sql = sql
      .replace(
        "'@'||actor.username AS actor_name,",
        `to_char(audit.occurred_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_time,
      '@'||actor.username AS actor_name,`,
      )
      .replace(
        "ORDER BY audit.occurred_at",
        `AND ($6::timestamptz IS NULL OR (audit.occurred_at,audit.id)<($6::timestamptz,$7::bigint))
        ORDER BY audit.occurred_at`,
      )
      .replace("LIMIT 5", "LIMIT $8");
  }
  return sql;
}

/** Total dan halaman dihitung dari cohort berizin yang sama dalam satu snapshot SQL. */
export function buildOrganizationActivityHistorySql() {
  const visible = buildOrganizationActivitySql()
    .replace(
      "'@'||actor.username AS actor_name,",
      `to_char(audit.occurred_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_time,
       '@'||actor.username AS actor_name,`,
    )
    .replace("ORDER BY audit.occurred_at DESC,audit.id DESC LIMIT 5", "");
  return `WITH visible AS (${visible}), page AS (
    SELECT id,action,entity_type,occurred_at,cursor_time,actor_name,
      employee_name,employee_no,target_username,target_name,report_kind,employee_count,import_count,timezone
    FROM visible
    WHERE ($6::timestamptz IS NULL OR (occurred_at,id::bigint)<($6::timestamptz,$7::bigint))
    ORDER BY occurred_at DESC,id::bigint DESC LIMIT $8
  ) SELECT (SELECT count(*)::int FROM visible) AS total,
    COALESCE((SELECT jsonb_agg(page ORDER BY occurred_at DESC,id::bigint DESC) FROM page),'[]'::jsonb) AS items`;
}
