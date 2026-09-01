import bcrypt from "bcryptjs";
import pool from "@/lib/dbConfig";
import { withTransaction } from "@/lib/dbTransaction";
import { writeAudit } from "@/lib/audit";
import { ServiceError } from "@/lib/api/routeHelpers";
import { ensureActorEmployeeAccess, getActorLocationScope } from "@/lib/auth/permissions";
import { canLinkOwnEmployeeProfile } from "@/lib/account/profilePolicy.mjs";

function assertCanLinkSelfProfile(actor) {
  if (!canLinkOwnEmployeeProfile(actor.role_code))
    throw new ServiceError(
      "PROFILE_LINK_FORBIDDEN",
      "Hanya HRD dan Pimpinan yang dapat mengaitkan akun sendiri ke profil pegawai.",
      403,
    );
  if (!actor.organization_id)
    throw new ServiceError("ORGANIZATION_REQUIRED", "Akun belum terhubung ke organisasi.", 403);
}

export async function getSelfProfile(userId, database = pool) {
  const result = await database.query(
    `SELECT user_account.id::text,user_account.username,user_account.is_active,
      identity.display_name,identity.identity_source,identity.contact_email,identity.whatsapp,
      identity.employee_id::text,identity.employee_organization_id::text,identity.preferred_name,identity.personal_email,identity.work_email,
      employee.employee_no,employee.full_name,employee.employment_status,
      employee_organization.name AS employee_organization_name,
      active_assignment.location_name,active_assignment.organization_unit_name,
      active_assignment.position_name,
      platform_profile.full_name AS platform_full_name,platform_profile.email AS platform_email,
      platform_profile.updated_at
    FROM users user_account JOIN v_user_identity identity ON identity.user_id=user_account.id
    LEFT JOIN employees employee ON employee.id=identity.employee_id
    LEFT JOIN organizations employee_organization ON employee_organization.id=employee.organization_id
    LEFT JOIN LATERAL (
      SELECT location.name AS location_name,organization_unit.name AS organization_unit_name,
        position.name AS position_name
      FROM employee_assignments assignment
      JOIN locations location ON location.organization_id=assignment.organization_id
        AND location.id=assignment.location_id
      JOIN organization_units organization_unit ON organization_unit.organization_id=assignment.organization_id
        AND organization_unit.id=assignment.organization_unit_id
      JOIN positions position ON position.organization_id=assignment.organization_id
        AND position.id=assignment.position_id
      WHERE assignment.organization_id=employee.organization_id AND assignment.employee_id=employee.id
        AND assignment.assignment_type='primary' AND assignment.effective_from<=current_date
        AND (assignment.effective_until IS NULL OR assignment.effective_until>=current_date)
      ORDER BY assignment.effective_from DESC,assignment.id DESC LIMIT 1
    ) active_assignment ON true
    LEFT JOIN platform_user_profiles platform_profile ON platform_profile.user_id=user_account.id
    WHERE user_account.id=$1`,
    [userId],
  );
  if (!result.rows[0])
    throw new ServiceError("PROFILE_NOT_FOUND", "Profil akun tidak ditemukan.", 404);
  const row = result.rows[0];
  return {
    ...row,
    profile_linked: row.identity_source !== "username",
    recovery_ready: false,
    recovery_contact_available: Boolean(row.whatsapp),
    editable_fields:
      row.identity_source === "employee"
        ? ["preferredName", "personalEmail", "whatsapp"]
        : row.identity_source === "platform"
          ? ["fullName", "email", "whatsapp"]
          : [],
  };
}

export async function updateSelfProfile(input, actor, requestId) {
  return withTransaction(async (client) => {
    const before = await getSelfProfile(actor.id, client);
    if (before.identity_source === "employee") {
      if (
        !before.employee_id ||
        String(actor.organization_id) !==
          String(before.employee_organization_id || actor.organization_id)
      )
        throw new ServiceError(
          "PROFILE_FORBIDDEN",
          "Profil pegawai tidak berada pada organisasi akun.",
          403,
        );
      await client.query(
        "UPDATE employees SET preferred_name=$3,updated_at=now() WHERE id=$1 AND organization_id=$2",
        [before.employee_id, actor.organization_id, input.preferredName || null],
      );
      await client.query(
        `INSERT INTO employee_contacts(organization_id,employee_id,personal_email,whatsapp)
         VALUES($1,$2,$3,$4)
         ON CONFLICT (employee_id) DO UPDATE SET personal_email=excluded.personal_email,
           whatsapp=excluded.whatsapp,updated_at=now()`,
        [
          actor.organization_id,
          before.employee_id,
          input.personalEmail || null,
          input.whatsapp || null,
        ],
      );
    } else if (before.identity_source === "platform" && actor.role_scope === "platform") {
      await client.query(
        `INSERT INTO platform_user_profiles(user_id,full_name,email,whatsapp)
         VALUES($1,$2,$3,$4)
         ON CONFLICT (user_id) DO UPDATE SET full_name=excluded.full_name,email=excluded.email,
           whatsapp=excluded.whatsapp,updated_at=now()`,
        [
          actor.id,
          input.fullName || before.platform_full_name,
          input.email || null,
          input.whatsapp || null,
        ],
      );
    } else {
      throw new ServiceError(
        "PROFILE_NOT_LINKED",
        "Akun belum terhubung ke profil. Hubungi administrator organisasi.",
        409,
      );
    }
    await writeAudit(client, {
      organizationId: actor.organization_id,
      actorUserId: actor.id,
      action: "profile_self.update",
      entityType: before.identity_source === "platform" ? "platform_user_profile" : "employee",
      entityId: before.identity_source === "platform" ? actor.id : before.employee_id,
      beforeData: { identitySource: before.identity_source },
      afterData: { whatsappChanged: before.whatsapp !== (input.whatsapp || null) },
      requestId,
    });
    return getSelfProfile(actor.id, client);
  });
}

/** Menampilkan profil aktif yang belum memiliki akun dan berada dalam cakupan actor. */
export async function getSelfProfileLinkOptions(actor, database = pool) {
  assertCanLinkSelfProfile(actor);
  const scopedLocationIds = await getActorLocationScope(actor, database);
  const result = await database.query(
    `SELECT employee.id::text,employee.employee_no,employee.full_name,
      active_assignment.position_name
     FROM employees employee
     LEFT JOIN LATERAL (
       SELECT position.name AS position_name
       FROM employee_assignments assignment
       LEFT JOIN positions position ON position.organization_id=assignment.organization_id
         AND position.id=assignment.position_id
       WHERE assignment.organization_id=employee.organization_id
         AND assignment.employee_id=employee.id AND assignment.assignment_type='primary'
         AND assignment.effective_from<=current_date
         AND (assignment.effective_until IS NULL OR assignment.effective_until>=current_date)
       ORDER BY assignment.effective_from DESC,assignment.id DESC LIMIT 1
     ) active_assignment ON true
     WHERE employee.organization_id=$1 AND employee.deleted_at IS NULL
       AND employee.user_id IS NULL AND employee.employment_status IN ('active','probation')
       AND ($2::bigint[] IS NULL OR EXISTS(
         SELECT 1 FROM employee_assignments assignment
         WHERE assignment.organization_id=employee.organization_id
           AND assignment.employee_id=employee.id AND assignment.assignment_type='primary'
           AND assignment.effective_from<=current_date
           AND (assignment.effective_until IS NULL OR assignment.effective_until>=current_date)
           AND assignment.location_id=ANY($2::bigint[])))
     ORDER BY employee.full_name,employee.employee_no LIMIT 500`,
    [actor.organization_id, scopedLocationIds],
  );
  return result.rows;
}

/** Menautkan akun sendiri ke satu profil pegawai secara permanen dan diaudit. */
export async function linkSelfProfile(input, actor, requestId) {
  assertCanLinkSelfProfile(actor);
  try {
    return await withTransaction(async (client) => {
      await client.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [actor.id]);
      const existing = await client.query(
        `SELECT id FROM employees WHERE organization_id=$1 AND user_id=$2
         AND deleted_at IS NULL FOR UPDATE`,
        [actor.organization_id, actor.id],
      );
      if (existing.rows[0])
        throw new ServiceError(
          "PROFILE_ALREADY_LINKED",
          "Akun sudah terhubung ke profil pegawai.",
          409,
        );

      await ensureActorEmployeeAccess(actor, input.employeeId, actor.organization_id, client);
      const target = await client.query(
        `SELECT id,user_id,full_name FROM employees
         WHERE organization_id=$1 AND id=$2 AND deleted_at IS NULL
           AND employment_status IN ('active','probation') FOR UPDATE`,
        [actor.organization_id, input.employeeId],
      );
      if (!target.rows[0])
        throw new ServiceError(
          "EMPLOYEE_PROFILE_INVALID",
          "Profil pegawai tidak tersedia atau hubungan kerjanya tidak aktif.",
          400,
          { employeeId: "Pilih profil pegawai yang masih aktif." },
        );
      if (target.rows[0].user_id)
        throw new ServiceError(
          "EMPLOYEE_ACCOUNT_EXISTS",
          "Profil pegawai sudah terhubung ke akun lain.",
          409,
          { employeeId: "Pilih profil yang belum memiliki akun." },
        );

      await client.query(
        "UPDATE employees SET user_id=$3,updated_at=now() WHERE organization_id=$1 AND id=$2",
        [actor.organization_id, input.employeeId, actor.id],
      );
      await writeAudit(client, {
        organizationId: actor.organization_id,
        actorUserId: actor.id,
        action: "profile_self.link",
        entityType: "employee",
        entityId: input.employeeId,
        beforeData: { userId: null },
        afterData: { userId: String(actor.id), linkedBySelf: true },
        requestId,
      });
      return getSelfProfile(actor.id, client);
    });
  } catch (error) {
    if (error?.code === "23505")
      throw new ServiceError(
        "EMPLOYEE_ACCOUNT_EXISTS",
        "Profil pegawai sudah terhubung ke akun lain.",
        409,
      );
    throw error;
  }
}

export async function changeSelfPassword(input, actor, requestId) {
  return withTransaction(async (client) => {
    const result = await client.query("SELECT password_hash FROM users WHERE id=$1 FOR UPDATE", [
      actor.id,
    ]);
    const passwordMatches = await bcrypt.compare(
      input.currentPassword,
      result.rows[0]?.password_hash || "",
    );
    if (!passwordMatches)
      throw new ServiceError("CURRENT_PASSWORD_INVALID", "Password saat ini tidak benar.", 400);
    await client.query(
      `UPDATE users SET password_hash=$2,credential_version=credential_version+1,updated_at=now()
       WHERE id=$1`,
      [actor.id, await bcrypt.hash(input.newPassword, 12)],
    );
    await writeAudit(client, {
      organizationId: actor.organization_id,
      actorUserId: actor.id,
      action: "profile_self.password_change",
      entityType: "user",
      entityId: actor.id,
      afterData: { passwordChanged: true, sessionsRevoked: true },
      requestId,
    });
    return { id: String(actor.id), sessionsRevoked: true };
  });
}
