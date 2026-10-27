import pool from "@/lib/dbConfig";
import { subscriptionLateral } from "../userRepository";

/** Profil berasal dari user_id, bukan membership terpilih atau employee_id kiriman. */
export async function findMobileUser(value, { byId = false } = {}) {
  const { rows } = await pool.query(
    `SELECT u.id,u.username,u.password_hash,u.is_active,u.credential_version,
    employee_profile.id AS employee_id,employee_profile.deleted_at AS employee_deleted_at,
    employee_profile.employment_status,
    COALESCE(employee_profile.organization_id,active_role.organization_id) AS organization_id,
    active_role.id AS role_assignment_id,active_role.role_code,
    o.is_active AS organization_is_active,subscription.effective_status AS organization_subscription_status
    FROM users u
    LEFT JOIN employees employee_profile ON employee_profile.user_id=u.id
    LEFT JOIN LATERAL (
      SELECT membership.id,membership.organization_id,role.code AS role_code
      FROM user_organization_roles membership JOIN roles role ON role.id=membership.role_id
      WHERE membership.user_id=u.id AND role.code IN ('hrd','leader','employee')
        AND (employee_profile.id IS NULL OR membership.organization_id=employee_profile.organization_id)
        AND membership.active_from<=now() AND (membership.active_until IS NULL OR membership.active_until>now())
      ORDER BY CASE role.code WHEN 'hrd' THEN 1 WHEN 'leader' THEN 2 ELSE 3 END,membership.id DESC LIMIT 1
    ) active_role ON true
    LEFT JOIN organizations o ON o.id=COALESCE(employee_profile.organization_id,active_role.organization_id)
    ${subscriptionLateral}
    WHERE ${byId ? "u.id=$1::bigint" : "u.username=$1"} LIMIT 1`,
    [value],
  );
  return rows[0] || null;
}
