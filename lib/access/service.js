import bcrypt from "bcryptjs";
import pool from "@/lib/dbConfig";
import { withTransaction } from "@/lib/dbTransaction";
import { writeAudit } from "@/lib/audit";
import { ServiceError } from "@/lib/api/routeHelpers";
import { ensureActorEmployeeAccess } from "@/lib/auth/permissions";

const accountSelect = `SELECT user_account.id::text,user_account.username,identity.display_name,
  identity.contact_email,identity.whatsapp,identity.identity_source,
  (employee.id IS NOT NULL) AS profile_linked,user_account.is_active,user_account.last_login_at,
  user_account.updated_at,membership.id::text AS membership_id,membership.organization_id::text,
  membership.location_scope_mode,organization.name AS organization_name,role.code AS role_code,
  role.name AS role_name,employee.id::text AS employee_id,employee.employee_no,
  employee.full_name AS employee_name,
  COALESCE(json_agg(json_build_object('id',location.id::text,'code',location.code,'name',location.name)
    ORDER BY location.name) FILTER (WHERE location.id IS NOT NULL),'[]'::json) AS locations
 FROM users user_account
 JOIN v_user_identity identity ON identity.user_id=user_account.id
 JOIN user_organization_roles membership ON membership.user_id=user_account.id
 JOIN roles role ON role.id=membership.role_id AND role.code IN ('hrd','leader','employee')
 JOIN organizations organization ON organization.id=membership.organization_id
 LEFT JOIN employees employee ON employee.organization_id=membership.organization_id
   AND employee.user_id=user_account.id AND employee.deleted_at IS NULL
 LEFT JOIN user_location_scopes scope ON scope.user_organization_role_id=membership.id
 LEFT JOIN locations location ON location.organization_id=scope.organization_id AND location.id=scope.location_id`;

/** Menormalkan hasil aggregate agar form dan card mobile memakai kontrak yang sama. */
function normalizeAccount(row) {
  return {
    ...row,
    location_ids: (row.locations || []).map((location) => location.id),
    recovery_ready: false,
    recovery_contact_available: Boolean(row.whatsapp),
  };
}

/** Menampilkan akun organisasi beserta role, profil pegawai, dan cakupan lokasinya. */
export async function listOrganizationAccounts({
  search,
  status,
  page,
  pageSize,
  organizationId,
  roleCode,
}) {
  const offset = (page - 1) * pageSize;
  const where = `WHERE membership.organization_id=$1
    AND ($2='' OR user_account.username ILIKE $2 OR identity.display_name ILIKE $2
      OR COALESCE(identity.contact_email,'') ILIKE $2 OR COALESCE(employee.employee_no,'') ILIKE $2)
    AND ($3='all' OR user_account.is_active=($3='active'))
    AND ($4='all' OR role.code=$4)`;
  const group = `GROUP BY user_account.id,membership.id,organization.name,role.code,role.name,
    employee.id,employee.employee_no,employee.full_name,identity.user_id,identity.display_name,
    identity.contact_email,identity.whatsapp,identity.identity_source`;
  const params = [organizationId, `%${search}%`, status, roleCode, pageSize, offset];
  const [rows, count] = await Promise.all([
    pool.query(
      `${accountSelect} ${where} ${group} ORDER BY identity.display_name,user_account.id LIMIT $5 OFFSET $6`,
      params,
    ),
    pool.query(
      `SELECT count(DISTINCT membership.id)::int AS total FROM users user_account
 JOIN v_user_identity identity ON identity.user_id=user_account.id
       JOIN user_organization_roles membership ON membership.user_id=user_account.id
       JOIN roles role ON role.id=membership.role_id AND role.code IN ('hrd','leader','employee')
       LEFT JOIN employees employee ON employee.organization_id=membership.organization_id
         AND employee.user_id=user_account.id AND employee.deleted_at IS NULL ${where}`,
      params.slice(0, 4),
    ),
  ]);
  return { data: rows.rows.map(normalizeAccount), total: count.rows[0].total };
}

/** Mengambil satu akun dari organisasi tertentu untuk mencegah akses lintas organisasi. */
export async function getOrganizationAccount(id, organizationId, database = pool) {
  const result = await database.query(
    `${accountSelect} WHERE user_account.id=$1 AND membership.organization_id=$2
     GROUP BY user_account.id,membership.id,organization.name,role.code,role.name,
       employee.id,employee.employee_no,employee.full_name,identity.user_id,identity.display_name,
       identity.contact_email,identity.whatsapp,identity.identity_source`,
    [id, organizationId],
  );
  if (!result.rows[0]) throw new ServiceError("NOT_FOUND", "Akun organisasi tidak ditemukan.", 404);
  return normalizeAccount(result.rows[0]);
}

/** Memvalidasi profil opsional, role organisasi, serta daftar lokasi aktif. */
async function validateAccountReferences(client, input, { currentUserId = null } = {}) {
  if (input.employeeId) {
    const employee = await client.query(
      `SELECT id,user_id FROM employees WHERE id=$1 AND organization_id=$2
        AND deleted_at IS NULL AND employment_status NOT IN ('terminated','retired','deceased') FOR UPDATE`,
      [input.employeeId, input.organizationId],
    );
    if (!employee.rows[0])
      throw new ServiceError("EMPLOYEE_INVALID", "Profil pegawai tidak tersedia.", 400);
    if (employee.rows[0].user_id && String(employee.rows[0].user_id) !== String(currentUserId))
      throw new ServiceError("EMPLOYEE_ACCOUNT_EXISTS", "Pegawai sudah memiliki akun.", 409);
  }
  const role = await client.query(
    "SELECT id FROM roles WHERE code=$1 AND scope IN ('organization','self')",
    [input.roleCode],
  );
  if (!role.rows[0]) throw new ServiceError("ROLE_INVALID", "Role akun tidak tersedia.", 400);
  const locationIds =
    input.roleCode === "hrd" && input.locationScopeMode === "selected"
      ? [...new Set(input.locationIds.map(Number))]
      : [];
  if (locationIds.length) {
    const locations = await client.query(
      `SELECT id FROM locations WHERE organization_id=$1 AND id=ANY($2::bigint[]) AND is_active
       AND operational_from<=current_date AND (operational_until IS NULL OR operational_until>=current_date)`,
      [input.organizationId, locationIds],
    );
    if (locations.rowCount !== locationIds.length)
      throw new ServiceError(
        "LOCATION_SCOPE_INVALID",
        "Cakupan lokasi tidak valid atau tidak aktif.",
        400,
      );
  }
  return { roleId: role.rows[0].id, locationIds };
}

/** Menyimpan scope secara eksplisit; selected tanpa lokasi tidak pernah dianggap akses penuh. */
async function replaceLocationScopes(client, membershipId, organizationId, locationIds) {
  await client.query("DELETE FROM user_location_scopes WHERE user_organization_role_id=$1", [
    membershipId,
  ]);
  if (locationIds.length)
    await client.query(
      `INSERT INTO user_location_scopes(user_organization_role_id,organization_id,location_id)
       SELECT $1,$2,unnest($3::bigint[])`,
      [membershipId, organizationId, locationIds],
    );
}

/** Membuat akun organisasi dan menautkan profil hanya ketika pengguna memilihnya. */
export async function createOrganizationAccount(input, actor, requestId) {
  try {
    return await withTransaction(async (client) => {
      if (input.employeeId)
        await ensureActorEmployeeAccess(actor, input.employeeId, input.organizationId, client);
      const references = await validateAccountReferences(client, input);
      const inserted = await client.query(
        `INSERT INTO users(username,password_hash,is_active) VALUES ($1,$2,$3) RETURNING id`,
        [input.username, await bcrypt.hash(input.password, 12), input.isActive],
      );
      const userId = inserted.rows[0].id;
      const membership = await client.query(
        `INSERT INTO user_organization_roles
          (user_id,organization_id,role_id,location_scope_mode,active_until,created_by_user_id)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [
          userId,
          input.organizationId,
          references.roleId,
          input.roleCode === "hrd" ? input.locationScopeMode : "all",
          input.isActive ? null : new Date(),
          actor.id,
        ],
      );
      await replaceLocationScopes(
        client,
        membership.rows[0].id,
        input.organizationId,
        references.locationIds,
      );
      if (input.employeeId)
        await client.query(
          "UPDATE employees SET user_id=$2,updated_at=now() WHERE id=$1 AND organization_id=$3",
          [input.employeeId, userId, input.organizationId],
        );
      await writeAudit(client, {
        organizationId: input.organizationId,
        actorUserId: actor.id,
        action: "organization_account.create",
        entityType: "user",
        entityId: userId,
        afterData: {
          employeeId: input.employeeId ? String(input.employeeId) : null,
          roleCode: input.roleCode,
          locationScopeMode: input.locationScopeMode,
        },
        requestId,
      });
      return getOrganizationAccount(userId, input.organizationId, client);
    });
  } catch (error) {
    if (error?.code === "23505")
      throw new ServiceError(
        "DUPLICATE_ACCOUNT",
        "Username atau profil pegawai sudah digunakan.",
        409,
      );
    throw error;
  }
}

/** Menolak penonaktifan diri dan HRD aktif terakhir dalam organisasi. */
async function guardAccountDeactivation(client, before, input, actor) {
  const losesHrdAccess =
    before.role_code === "hrd" && (!input.isActive || input.roleCode !== "hrd");
  if (!input.isActive && String(before.id) === String(actor.id))
    throw new ServiceError(
      "SELF_DEACTIVATION_FORBIDDEN",
      "Anda tidak dapat menonaktifkan akun sendiri.",
      409,
    );
  if (!losesHrdAccess) return;
  const remaining = await client.query(
    `SELECT count(*)::int AS total FROM user_organization_roles membership
     JOIN roles role ON role.id=membership.role_id AND role.code='hrd'
     JOIN users user_account ON user_account.id=membership.user_id
     WHERE membership.organization_id=$1 AND user_account.is_active AND user_account.id<>$2
       AND membership.active_from<=now() AND (membership.active_until IS NULL OR membership.active_until>now())`,
    [before.organization_id, before.id],
  );
  if (!remaining.rows[0].total)
    throw new ServiceError(
      "LAST_HRD_REQUIRED",
      "HRD aktif terakhir tidak dapat dinonaktifkan.",
      409,
    );
}

/** Memperbarui identitas akun, role, tautan pegawai, dan scope dengan version check. */
export async function updateOrganizationAccount(id, input, actor, requestId) {
  try {
    return await withTransaction(async (client) => {
      const before = await getOrganizationAccount(id, input.organizationId, client);
      if (input.employeeId)
        await ensureActorEmployeeAccess(actor, input.employeeId, input.organizationId, client);
      await guardAccountDeactivation(client, before, input, actor);
      const references = await validateAccountReferences(client, input, { currentUserId: id });
      const updated = await client.query(
        `UPDATE users SET username=$2,is_active=$3,updated_at=now()
         WHERE id=$1 AND date_trunc('milliseconds',updated_at)=date_trunc('milliseconds',$4::timestamptz)
         RETURNING id`,
        [id, input.username, input.isActive, input.version],
      );
      if (!updated.rowCount)
        throw new ServiceError(
          "VERSION_CONFLICT",
          "Data telah berubah. Muat ulang sebelum menyimpan.",
          409,
        );
      await client.query(
        `UPDATE user_organization_roles SET role_id=$2,location_scope_mode=$3,
          active_until=$4 WHERE id=$1`,
        [
          before.membership_id,
          references.roleId,
          input.roleCode === "hrd" ? input.locationScopeMode : "all",
          input.isActive ? null : new Date(),
        ],
      );
      await replaceLocationScopes(
        client,
        before.membership_id,
        input.organizationId,
        references.locationIds,
      );
      await client.query(
        "UPDATE employees SET user_id=NULL,updated_at=now() WHERE organization_id=$1 AND user_id=$2",
        [input.organizationId, id],
      );
      if (input.employeeId)
        await client.query(
          "UPDATE employees SET user_id=$2,updated_at=now() WHERE organization_id=$1 AND id=$3",
          [input.organizationId, id, input.employeeId],
        );
      await writeAudit(client, {
        organizationId: input.organizationId,
        actorUserId: actor.id,
        action: "organization_account.update",
        entityType: "user",
        entityId: id,
        beforeData: {
          roleCode: before.role_code,
          employeeId: before.employee_id,
          isActive: before.is_active,
        },
        afterData: {
          roleCode: input.roleCode,
          employeeId: input.employeeId ? String(input.employeeId) : null,
          isActive: input.isActive,
        },
        requestId,
      });
      return getOrganizationAccount(id, input.organizationId, client);
    });
  } catch (error) {
    if (error?.code === "23505")
      throw new ServiceError(
        "DUPLICATE_ACCOUNT",
        "Username atau profil pegawai sudah digunakan.",
        409,
      );
    throw error;
  }
}

/** Mengganti password tanpa menulis nilai polos ke log atau audit. */
export async function resetOrganizationAccountPassword(
  id,
  organizationId,
  password,
  actor,
  requestId,
) {
  return withTransaction(async (client) => {
    await getOrganizationAccount(id, organizationId, client);
    await client.query("UPDATE users SET password_hash=$2,credential_version=credential_version+1,updated_at=now() WHERE id=$1", [
      id,
      await bcrypt.hash(password, 12),
    ]);
    await writeAudit(client, {
      organizationId,
      actorUserId: actor.id,
      action: "organization_account.password_reset",
      entityType: "user",
      entityId: id,
      afterData: { passwordChanged: true },
      requestId,
    });
    return { id: String(id) };
  });
}
