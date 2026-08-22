import pool from "@/lib/dbConfig";
import { effectiveSubscriptionStatusSql } from "@/lib/subscriptions/service";

const ACTIVE_ROLE_ORDER = `CASE r.code WHEN 'superadmin' THEN 1 WHEN 'hrd' THEN 2 WHEN 'leader' THEN 3 WHEN 'employee' THEN 4 ELSE 99 END`;
const subscriptionLateral = `LEFT JOIN LATERAL (
  SELECT os.id,os.starts_on,os.ends_on,os.grace_ends_on,${effectiveSubscriptionStatusSql()} AS effective_status,
    (CASE WHEN (now() AT TIME ZONE o.timezone)::date<=os.ends_on THEN os.ends_on ELSE COALESCE(os.grace_ends_on,os.ends_on) END-(now() AT TIME ZONE o.timezone)::date)::int AS days_remaining
  FROM organization_subscriptions os WHERE os.organization_id=o.id
  ORDER BY CASE WHEN os.status NOT IN ('suspended','cancelled')
    AND (now() AT TIME ZONE o.timezone)::date BETWEEN os.starts_on AND COALESCE(os.grace_ends_on,os.ends_on) THEN 0
    WHEN os.status NOT IN ('suspended','cancelled') AND os.starts_on>(now() AT TIME ZONE o.timezone)::date THEN 1 ELSE 2 END,
    os.starts_on DESC,os.id DESC LIMIT 1
) subscription ON true`;

/** Menyediakan konteks penempatan karyawan yang dipakai konsisten saat login dan validasi sesi. */
const employeeAccessJoins = (organizationIdExpression) => `
  LEFT JOIN employees employee_profile
    ON employee_profile.user_id=u.id AND employee_profile.organization_id=${organizationIdExpression}
  LEFT JOIN LATERAL (
    SELECT assignment.id,location.is_active AS location_is_active,
      (location.operational_from<=(now() AT TIME ZONE o.timezone)::date
        AND (location.operational_until IS NULL OR location.operational_until>=(now() AT TIME ZONE o.timezone)::date)) AS location_is_operational,
      organization_unit.is_active AS unit_is_active
    FROM employee_assignments assignment
    JOIN locations location
      ON location.organization_id=assignment.organization_id AND location.id=assignment.location_id
    JOIN organization_units organization_unit
      ON organization_unit.organization_id=assignment.organization_id
      AND organization_unit.id=assignment.organization_unit_id
    WHERE assignment.organization_id=${organizationIdExpression}
      AND assignment.employee_id=employee_profile.id
      AND assignment.assignment_type='primary'
      AND assignment.effective_from<=(now() AT TIME ZONE o.timezone)::date
      AND (assignment.effective_until IS NULL
        OR assignment.effective_until>=(now() AT TIME ZONE o.timezone)::date)
    ORDER BY assignment.effective_from DESC,assignment.id DESC
    LIMIT 1
  ) employee_assignment ON true`;

const employeeAccessColumns = `employee_profile.id AS employee_id,
  employee_profile.employment_status,employee_profile.deleted_at AS employee_deleted_at,
  employee_assignment.id AS employee_assignment_id,
  employee_assignment.location_is_active AS employee_location_is_active,
  employee_assignment.location_is_operational AS employee_location_is_operational,
  employee_assignment.unit_is_active AS employee_unit_is_active`;

export async function findUserForLogin(username) {
  const result = await pool.query(
    `SELECT u.id,u.username,u.password_hash,u.full_name,u.is_active,
    active_role.organization_id,active_role.role_assignment_id,active_role.role_code,
    active_role.role_scope,active_role.location_scope_mode,
    o.name AS organization_name,o.timezone AS organization_timezone,o.is_active AS organization_is_active,
    subscription.starts_on::text AS organization_subscription_starts_on,
    subscription.ends_on::text AS organization_subscription_ends_on,
    subscription.grace_ends_on::text AS organization_subscription_grace_ends_on,
    subscription.effective_status AS organization_subscription_status,
    ${employeeAccessColumns},
    CASE WHEN active_role.role_code='hrd' AND active_role.location_scope_mode='selected' THEN EXISTS (
      SELECT 1 FROM user_location_scopes uls JOIN locations l ON l.organization_id=uls.organization_id AND l.id=uls.location_id
      WHERE uls.user_organization_role_id=active_role.role_assignment_id AND l.is_active
        AND l.operational_from<=(now() AT TIME ZONE o.timezone)::date
        AND (l.operational_until IS NULL OR l.operational_until>=(now() AT TIME ZONE o.timezone)::date)
    ) ELSE true END AS has_active_location_scope
    FROM users u LEFT JOIN LATERAL (
      SELECT uor.organization_id,uor.id AS role_assignment_id,r.code AS role_code,r.scope AS role_scope,
        uor.location_scope_mode
      FROM user_organization_roles uor JOIN roles r ON r.id=uor.role_id WHERE uor.user_id=u.id
        AND uor.active_from<=now() AND (uor.active_until IS NULL OR uor.active_until>now())
      ORDER BY ${ACTIVE_ROLE_ORDER},uor.active_from DESC LIMIT 1
    ) active_role ON true LEFT JOIN organizations o ON o.id=active_role.organization_id
    ${subscriptionLateral}
    ${employeeAccessJoins("active_role.organization_id")}
    WHERE u.username=$1 LIMIT 1`,
    [username],
  );
  return result.rows[0] || null;
}

export async function findActiveSessionUser({ userId, roleCode, organizationId }) {
  const result = await pool.query(
    `SELECT u.id,u.username,u.full_name,u.is_active,r.code AS role_code,r.scope AS role_scope,
    uor.organization_id,uor.id AS role_assignment_id,uor.location_scope_mode,
    o.name AS organization_name,o.timezone AS organization_timezone,
    subscription.starts_on::text AS organization_subscription_starts_on,
    subscription.ends_on::text AS organization_subscription_ends_on,
    subscription.grace_ends_on::text AS organization_subscription_grace_ends_on,
    subscription.days_remaining AS organization_days_remaining,
    subscription.effective_status AS organization_subscription_status,
    ${employeeAccessColumns}
    FROM users u JOIN user_organization_roles uor ON uor.user_id=u.id JOIN roles r ON r.id=uor.role_id
    LEFT JOIN organizations o ON o.id=uor.organization_id ${subscriptionLateral}
    ${employeeAccessJoins("uor.organization_id")}
    WHERE u.id=$1 AND u.is_active=true AND r.code=$2 AND uor.organization_id IS NOT DISTINCT FROM $3::bigint
      AND uor.active_from<=now() AND (uor.active_until IS NULL OR uor.active_until>now())
      AND (r.scope='platform' OR (
        o.is_active=true AND subscription.effective_status IN ('active','grace') AND
        (r.code<>'hrd' OR uor.location_scope_mode='all' OR EXISTS (
          SELECT 1 FROM user_location_scopes uls JOIN locations l ON l.organization_id=uls.organization_id AND l.id=uls.location_id
          WHERE uls.user_organization_role_id=uor.id AND l.is_active
            AND l.operational_from<=(now() AT TIME ZONE o.timezone)::date
            AND (l.operational_until IS NULL OR l.operational_until>=(now() AT TIME ZONE o.timezone)::date)
        ))
        AND (r.code<>'employee' OR (
          employee_profile.id IS NOT NULL AND employee_profile.deleted_at IS NULL
          AND employee_profile.employment_status IN ('active','probation','leave')
          AND employee_assignment.id IS NOT NULL
          AND employee_assignment.location_is_active=true
          AND employee_assignment.location_is_operational=true
          AND employee_assignment.unit_is_active=true
        ))
      )) LIMIT 1`,
    [userId, roleCode, organizationId],
  );
  return result.rows[0] || null;
}

export async function recordSuccessfulLogin({ user, ipAddress, userAgent, requestId }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("UPDATE users SET last_login_at=now(),last_login_ip=$2::inet WHERE id=$1", [
      user.id,
      ipAddress,
    ]);
    await client.query(
      `INSERT INTO audit_logs (organization_id,actor_user_id,action,entity_type,entity_id,after_data,ip_address,user_agent,request_id)
      VALUES ($1::bigint,$2::bigint,'login.success','user',($2::bigint)::text,$3::jsonb,$4::inet,$5,$6::uuid)`,
      [
        user.organization_id,
        user.id,
        JSON.stringify({ role_code: user.role_code }),
        ipAddress,
        userAgent,
        requestId,
      ],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
