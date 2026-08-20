import pool from "@/lib/dbConfig";

const ACTIVE_ROLE_ORDER = `
  CASE r.code
    WHEN 'superadmin' THEN 1
    WHEN 'hrd' THEN 2
    WHEN 'leader' THEN 3
    WHEN 'employee' THEN 4
    ELSE 99
  END
`;

export async function findUserForLogin(username) {
  const result = await pool.query(
    `
      SELECT
        u.id,
        u.username,
        u.password_hash,
        u.full_name,
        u.is_active,
        active_role.organization_id,
        active_role.role_code,
        active_role.role_scope,
        o.name AS organization_name,
        o.timezone AS organization_timezone,
        o.active_from::text AS organization_active_from,
        o.active_until::text AS organization_active_until,
        o.is_active AS organization_is_active,
        CASE WHEN active_role.role_code = 'hrd' THEN EXISTS (
          SELECT 1 FROM user_location_scopes uls
          JOIN locations l ON l.organization_id=uls.organization_id AND l.id=uls.location_id
          WHERE uls.user_organization_role_id=active_role.role_assignment_id
            AND l.is_active
            AND l.active_from <= current_date
            AND (l.active_until IS NULL OR l.active_until >= current_date)
        ) ELSE true END AS has_active_location_scope
      FROM users u
      LEFT JOIN LATERAL (
        SELECT
          uor.organization_id,
          uor.id AS role_assignment_id,
          r.code AS role_code,
          r.scope AS role_scope
        FROM user_organization_roles uor
        JOIN roles r ON r.id = uor.role_id
        WHERE uor.user_id = u.id
          AND uor.active_from <= now()
          AND (uor.active_until IS NULL OR uor.active_until > now())
        ORDER BY ${ACTIVE_ROLE_ORDER}, uor.active_from DESC
        LIMIT 1
      ) active_role ON true
      LEFT JOIN organizations o ON o.id=active_role.organization_id
      WHERE u.username = $1
      LIMIT 1
    `,
    [username],
  );

  return result.rows[0] || null;
}

export async function findActiveSessionUser({ userId, roleCode, organizationId }) {
  const result = await pool.query(
    `
      SELECT
        u.id,
        u.username,
        u.full_name,
        u.is_active,
        r.code AS role_code,
        r.scope AS role_scope,
        uor.organization_id,
        o.name AS organization_name,
        o.timezone AS organization_timezone,
        o.active_from::text AS organization_active_from,
        o.active_until::text AS organization_active_until,
        (o.active_until - (now() AT TIME ZONE o.timezone)::date)::int AS organization_days_remaining,
        CASE
          WHEN r.scope='platform' THEN NULL
          WHEN o.active_until - (now() AT TIME ZONE o.timezone)::date <= 7 THEN 'critical'
          WHEN o.active_until - (now() AT TIME ZONE o.timezone)::date <= 30 THEN 'expiring'
          ELSE 'active'
        END AS organization_subscription_status
      FROM users u
      JOIN user_organization_roles uor ON uor.user_id = u.id
      JOIN roles r ON r.id = uor.role_id
      LEFT JOIN organizations o ON o.id=uor.organization_id
      WHERE u.id = $1
        AND u.is_active = true
        AND r.code = $2
        AND uor.organization_id IS NOT DISTINCT FROM $3::bigint
        AND uor.active_from <= now()
        AND (uor.active_until IS NULL OR uor.active_until > now())
        AND (
          r.scope='platform'
          OR (
            o.is_active=true
            AND (now() AT TIME ZONE o.timezone)::date BETWEEN o.active_from AND o.active_until
            AND (
              r.code<>'hrd'
              OR EXISTS (
                SELECT 1 FROM user_location_scopes uls
                JOIN locations l ON l.organization_id=uls.organization_id AND l.id=uls.location_id
                WHERE uls.user_organization_role_id=uor.id
                  AND l.is_active
                  AND l.active_from <= (now() AT TIME ZONE o.timezone)::date
                  AND (l.active_until IS NULL OR l.active_until >= (now() AT TIME ZONE o.timezone)::date)
              )
            )
          )
        )
      LIMIT 1
    `,
    [userId, roleCode, organizationId],
  );

  return result.rows[0] || null;
}

export async function recordSuccessfulLogin({ user, ipAddress, userAgent, requestId }) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE users SET last_login_at = now(), last_login_ip = $2::inet WHERE id = $1`,
      [user.id, ipAddress],
    );
    await client.query(
      `
        INSERT INTO audit_logs (
          organization_id,
          actor_user_id,
          action,
          entity_type,
          entity_id,
          after_data,
          ip_address,
          user_agent,
          request_id
        )
        VALUES (
          $1::bigint,
          $2::bigint,
          'login.success',
          'user',
          ($2::bigint)::text,
          $3::jsonb,
          $4::inet,
          $5,
          $6::uuid
        )
      `,
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
