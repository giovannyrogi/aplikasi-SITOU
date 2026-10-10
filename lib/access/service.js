import {
  readHrisState,
  readHrisStates,
  applyHrisAccountAccess,
  refreshHrisAccountActor,
} from "./hrisRepository";
import bcrypt from "bcryptjs";
import pool from "@/lib/dbConfig";
import { withTransaction } from "@/lib/dbTransaction";
import { writeAudit } from "@/lib/audit";
import { ServiceError } from "@/lib/api/routeHelpers";
import { ensureActorEmployeeAccess, getActorLocationScope } from "@/lib/auth/permissions";
import { readPackageGrants } from "./packageRepository";
import { getPackageOptions, replaceAccountPackages } from "./packages";
import {
  canManageOrganizationAccountRole,
  normalizeAccountInputForActor,
} from "@/lib/access/accountPolicy.mjs";
import { accountCapabilities } from "./hrisPolicy.mjs";

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

function assertActorOrganization(actor, organizationId) {
  if (actor.role_code !== "superadmin" && String(actor.organization_id) !== String(organizationId))
    throw new ServiceError(
      "ORGANIZATION_FORBIDDEN",
      "Anda tidak memiliki akses ke organisasi tersebut.",
      403,
    );
}

function assertActorCanManageAccount(actor, targetRoleCode) {
  if (!accountCapabilities(actor).canManageAccounts)
    throw new ServiceError(
      "ACCOUNT_MANAGEMENT_FORBIDDEN",
      "Izin mengelola akun Pegawai belum diberikan.",
      403,
    );
  if (
    !canManageOrganizationAccountRole(actor.role_code, targetRoleCode, actor.hrisContext?.fullAdmin)
  )
    throw new ServiceError(
      "ACCOUNT_ROLE_FORBIDDEN",
      "HRD hanya dapat mengelola akun Pegawai.",
      403,
    );
}
/** Akun terdelegasi tidak dapat menyelundupkan role HRD/Pimpinan melalui payload. */
function assertRequestedAccountRole(actor, input) {
  if (
    actor.role_code === "hrd" &&
    actor.hrisContext?.configured &&
    !actor.hrisContext.fullAdmin &&
    input.roleCode !== "employee"
  )
    throw new ServiceError(
      "ACCOUNT_ROLE_FORBIDDEN",
      "Anda hanya dapat mengelola akun Pegawai.",
      403,
      { roleCode: "Gunakan role Pegawai." },
    );
}

/** Memetakan konflik constraint ke field tanpa membocorkan detail database. */
function throwAccountConflict(error) {
  if (error?.code !== "23505") throw error;
  if (error.constraint === "users_username_key")
    throw new ServiceError("DUPLICATE_ACCOUNT", "Username sudah digunakan.", 409, {
      username: "Username sudah digunakan. Pilih username lain.",
    });
  if (error.constraint === "employees_user_id_key")
    throw new ServiceError(
      "EMPLOYEE_ACCOUNT_EXISTS",
      "Akun sudah terhubung ke profil pegawai lain.",
      409,
      { employeeId: "Satu akun hanya dapat terhubung ke satu profil pegawai." },
    );
  throw new ServiceError("DUPLICATE_ACCOUNT", "Akun sudah terdaftar. Muat ulang daftar akun.", 409);
}

/** Menampilkan akun organisasi beserta role, profil pegawai, dan cakupan lokasinya. */
export async function listOrganizationAccounts({
  search,
  status,
  page,
  pageSize,
  organizationId,
  roleCode,
  actorRoleCode,
  actor,
}) {
  const scopedLocationIds = actor ? await getActorLocationScope(actor) : null;
  const offset = (page - 1) * pageSize;
  const where = `WHERE membership.organization_id=$1
    AND ($2='' OR user_account.username ILIKE $2 OR identity.display_name ILIKE $2
      OR COALESCE(identity.contact_email,'') ILIKE $2 OR COALESCE(employee.employee_no,'') ILIKE $2)
    AND ($3='all' OR user_account.is_active=($3='active'))
    AND ($4='all' OR role.code=$4)
    AND ($5='superadmin' OR role.code='employee')
    AND ($6::bigint[] IS NULL OR EXISTS (
      SELECT 1 FROM employee_assignments assignment
      WHERE assignment.organization_id=membership.organization_id AND assignment.employee_id=employee.id
        AND assignment.assignment_type='primary' AND assignment.effective_from<=current_date
        AND (assignment.effective_until IS NULL OR assignment.effective_until>=current_date)
        AND assignment.location_id=ANY($6::bigint[])))`;
  const group = `GROUP BY user_account.id,membership.id,organization.name,role.code,role.name,
    employee.id,employee.employee_no,employee.full_name,identity.user_id,identity.display_name,
    identity.contact_email,identity.whatsapp,identity.identity_source`;
  const params = [
    organizationId,
    `%${search}%`,
    status,
    actorRoleCode === "hrd" && !actor?.hrisContext?.fullAdmin ? "employee" : roleCode,
    actor?.hrisContext?.fullAdmin ? "superadmin" : actorRoleCode,
    scopedLocationIds,
    pageSize,
    offset,
  ];
  const [rows, count] = await Promise.all([
    pool.query(
      `${accountSelect} ${where} ${group} ORDER BY identity.display_name,user_account.id LIMIT $7 OFFSET $8`,
      params,
    ),
    pool.query(
      `SELECT count(DISTINCT membership.id)::int AS total FROM users user_account
 JOIN v_user_identity identity ON identity.user_id=user_account.id
       JOIN user_organization_roles membership ON membership.user_id=user_account.id
       JOIN roles role ON role.id=membership.role_id AND role.code IN ('hrd','leader','employee')
       LEFT JOIN employees employee ON employee.organization_id=membership.organization_id
         AND employee.user_id=user_account.id AND employee.deleted_at IS NULL ${where}`,
      params.slice(0, 6),
    ),
  ]);
  const grants = await readPackageGrants(
    organizationId,
    rows.rows.map((row) => row.membership_id),
  );
  const hrisStates = await readHrisStates(organizationId, rows.rows);
  return {
    data: rows.rows.map((row) => ({
      ...normalizeAccount(row),
      hrisAccess: hrisStates.get(String(row.membership_id)) || null,
      packageAccess: grants.filter((g) => g.membership_id === String(row.membership_id)),
    })),
    total: count.rows[0].total,
  };
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
  return {
    ...normalizeAccount(result.rows[0]),
    hrisAccess: await readHrisState(
      organizationId,
      result.rows[0].membership_id,
      result.rows[0].role_code,
      database,
    ),
    packageAccess: await readPackageGrants(
      organizationId,
      [result.rows[0].membership_id],
      database,
    ),
  };
}

/** Membatasi detail akun dengan aturan visibilitas role yang sama seperti daftar. */
export async function getOrganizationAccountForActor(id, organizationId, actor, database = pool) {
  assertActorOrganization(actor, organizationId);
  const account = await getOrganizationAccount(id, organizationId, database);
  if (
    !canManageOrganizationAccountRole(
      actor.role_code,
      account.role_code,
      actor.hrisContext?.fullAdmin,
    )
  )
    throw new ServiceError("NOT_FOUND", "Akun organisasi tidak ditemukan.", 404);
  await ensureActorEmployeeAccess(actor, account.employee_id, organizationId, database);
  return account;
}

/** Referensi penautan akun: profil bebas atau profil akun edit yang telah diotorisasi. */
export async function getAccountReferenceOptions(organizationId, actor, accountId = null) {
  assertActorOrganization(actor, organizationId);
  const account = accountId
    ? await getOrganizationAccountForActor(accountId, organizationId, actor)
    : null;
  const scopedLocationIds = await getActorLocationScope(actor);
  const [employees, locations] = await Promise.all([
    pool.query(
      `SELECT employee.id::text,employee.employee_no,employee.full_name FROM employees employee
      WHERE employee.organization_id=$1 AND employee.deleted_at IS NULL
        AND employee.employment_status NOT IN ('terminated','retired','deceased')
        AND (employee.user_id IS NULL OR employee.user_id=$2::bigint)
        AND ($3::bigint[] IS NULL OR EXISTS (
          SELECT 1 FROM employee_assignments assignment WHERE assignment.organization_id=employee.organization_id
            AND assignment.employee_id=employee.id AND assignment.assignment_type='primary'
            AND assignment.effective_from<=current_date
            AND (assignment.effective_until IS NULL OR assignment.effective_until>=current_date)
            AND assignment.location_id=ANY($3::bigint[])))
      ORDER BY employee.full_name,employee.employee_no`,
      [organizationId, accountId, scopedLocationIds],
    ),
    pool.query(
      `SELECT id::text,name FROM locations WHERE organization_id=$1 AND is_active
      AND operational_from<=current_date AND (operational_until IS NULL OR operational_until>=current_date)
      AND ($2::bigint[] IS NULL OR id=ANY($2::bigint[])) ORDER BY name`,
      [organizationId, scopedLocationIds],
    ),
  ]);
  const lockedPackageCodes =
    scopedLocationIds === null
      ? []
      : (account?.packageAccess || [])
          .filter(
            (grant) =>
              grant.scopeMode === "all" ||
              grant.warehouses.some((w) => !scopedLocationIds.includes(String(w.location_id))),
          )
          .map((grant) => grant.packageCode);
  const hris = await readHrisState(organizationId, actor.role_assignment_id, "hrd");
  const activeAdmins = await pool.query(
    `SELECT count(*)::int total FROM user_organization_roles membership JOIN roles role ON role.id=membership.role_id JOIN users account ON account.id=membership.user_id WHERE membership.organization_id=$1 AND role.code='hrd' AND account.is_active AND membership.active_from<=now() AND (membership.active_until IS NULL OR membership.active_until>now())`,
    [organizationId],
  );
  return {
    canSetHrisAdmin: actor.role_code === "superadmin",
    ...accountCapabilities(actor),
    needsFirstHrisAdmin: !hris.configured && activeAdmins.rows[0].total === 0,
    hrisConfigured: hris.configured,
    hrisPolicyVersion: hris.version,
    employees: employees.rows,
    locations: locations.rows,
    ...(await getPackageOptions(organizationId, actor)),
    lockedPackageCodes,
  };
}

/** Memvalidasi profil opsional, role organisasi, serta daftar lokasi aktif. */
async function validateAccountReferences(client, input, { currentUserId = null } = {}) {
  if (input.roleCode === "employee" && !input.employeeId)
    throw new ServiceError(
      "EMPLOYEE_PROFILE_REQUIRED",
      "Profil pegawai wajib dipilih untuk akun Pegawai.",
      400,
      { employeeId: "Profil pegawai wajib dipilih untuk akun Pegawai." },
    );
  if (input.employeeId) {
    const employee = await client.query(
      `SELECT id,user_id FROM employees WHERE id=$1 AND organization_id=$2
        AND deleted_at IS NULL AND employment_status NOT IN ('terminated','retired','deceased') FOR UPDATE`,
      [input.employeeId, input.organizationId],
    );
    if (!employee.rows[0])
      throw new ServiceError("EMPLOYEE_INVALID", "Profil pegawai tidak tersedia.", 400);
    if (employee.rows[0].user_id && String(employee.rows[0].user_id) !== String(currentUserId))
      throw new ServiceError(
        "EMPLOYEE_ACCOUNT_EXISTS",
        "Profil pegawai sudah terhubung ke akun lain.",
        409,
        {
          employeeId:
            "Profil pegawai sudah terhubung ke akun lain. Pilih profil yang belum memiliki akun.",
        },
      );
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
  assertActorOrganization(actor, input.organizationId);
  let effectiveInput = normalizeAccountInputForActor(
    input,
    actor.role_code,
    actor.hrisContext?.fullAdmin,
  );
  try {
    return await withTransaction(async (client) => {
      actor = await refreshHrisAccountActor(client, actor, input.organizationId);
      assertRequestedAccountRole(actor, input);
      effectiveInput = normalizeAccountInputForActor(
        input,
        actor.role_code,
        actor.hrisContext?.fullAdmin,
      );
      if (effectiveInput.employeeId)
        await ensureActorEmployeeAccess(
          actor,
          effectiveInput.employeeId,
          effectiveInput.organizationId,
          client,
        );
      const references = await validateAccountReferences(client, effectiveInput);
      const inserted = await client.query(
        `INSERT INTO users(username,password_hash,is_active) VALUES ($1,$2,$3) RETURNING id`,
        [
          effectiveInput.username,
          await bcrypt.hash(effectiveInput.password, 12),
          effectiveInput.isActive,
        ],
      );
      const userId = inserted.rows[0].id;
      const membership = await client.query(
        `INSERT INTO user_organization_roles
          (user_id,organization_id,role_id,location_scope_mode,active_until,created_by_user_id)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [
          userId,
          effectiveInput.organizationId,
          references.roleId,
          effectiveInput.roleCode === "hrd" ? effectiveInput.locationScopeMode : "all",
          effectiveInput.isActive ? null : new Date(),
          actor.id,
        ],
      );
      await replaceLocationScopes(
        client,
        membership.rows[0].id,
        effectiveInput.organizationId,
        references.locationIds,
      );
      await replaceAccountPackages(client, {
        organizationId: effectiveInput.organizationId,
        membershipId: membership.rows[0].id,
        userId,
        grants: effectiveInput.packageAccess,
        actor,
        requestId,
      });
      if (effectiveInput.employeeId)
        await client.query(
          "UPDATE employees SET user_id=$2,updated_at=now() WHERE id=$1 AND organization_id=$3",
          [effectiveInput.employeeId, userId, effectiveInput.organizationId],
        );
      await writeAudit(client, {
        organizationId: effectiveInput.organizationId,
        actorUserId: actor.id,
        action: "organization_account.create",
        entityType: "user",
        entityId: userId,
        afterData: {
          employeeId: effectiveInput.employeeId ? String(effectiveInput.employeeId) : null,
          roleCode: effectiveInput.roleCode,
          locationScopeMode: effectiveInput.locationScopeMode,
        },
        requestId,
      });
      const target = await getOrganizationAccount(userId, effectiveInput.organizationId, client);
      await applyHrisAccountAccess(client, target, effectiveInput, actor, requestId, {
        created: true,
      });
      return getOrganizationAccount(userId, effectiveInput.organizationId, client);
    });
  } catch (error) {
    throwAccountConflict(error);
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
  assertActorOrganization(actor, input.organizationId);
  try {
    return await withTransaction(async (client) => {
      actor = await refreshHrisAccountActor(client, actor, input.organizationId);
      assertRequestedAccountRole(actor, input);
      const before = await getOrganizationAccountForActor(id, input.organizationId, actor, client);
      assertActorCanManageAccount(actor, before.role_code);
      const effectiveInput = normalizeAccountInputForActor(
        input,
        actor.role_code,
        actor.hrisContext?.fullAdmin,
      );
      if (effectiveInput.employeeId)
        await ensureActorEmployeeAccess(
          actor,
          effectiveInput.employeeId,
          effectiveInput.organizationId,
          client,
        );
      await guardAccountDeactivation(client, before, effectiveInput, actor);
      const references = await validateAccountReferences(client, effectiveInput, {
        currentUserId: id,
      });
      const updated = await client.query(
        `UPDATE users SET username=$2,is_active=$3,updated_at=now()
         WHERE id=$1 AND date_trunc('milliseconds',updated_at)=date_trunc('milliseconds',$4::timestamptz)
         RETURNING id`,
        [id, effectiveInput.username, effectiveInput.isActive, effectiveInput.version],
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
          effectiveInput.roleCode === "hrd" ? effectiveInput.locationScopeMode : "all",
          effectiveInput.isActive ? null : new Date(),
        ],
      );
      await replaceAccountPackages(client, {
        organizationId: effectiveInput.organizationId,
        membershipId: before.membership_id,
        userId: id,
        grants: effectiveInput.packageAccess,
        actor,
        requestId,
      });
      await replaceLocationScopes(
        client,
        before.membership_id,
        effectiveInput.organizationId,
        references.locationIds,
      );
      await client.query(
        "UPDATE employees SET user_id=NULL,updated_at=now() WHERE organization_id=$1 AND user_id=$2",
        [effectiveInput.organizationId, id],
      );
      if (effectiveInput.employeeId)
        await client.query(
          "UPDATE employees SET user_id=$2,updated_at=now() WHERE organization_id=$1 AND id=$3",
          [effectiveInput.organizationId, id, effectiveInput.employeeId],
        );
      await writeAudit(client, {
        organizationId: effectiveInput.organizationId,
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
          roleCode: effectiveInput.roleCode,
          employeeId: effectiveInput.employeeId ? String(effectiveInput.employeeId) : null,
          isActive: effectiveInput.isActive,
        },
        requestId,
      });
      await applyHrisAccountAccess(client, before, effectiveInput, actor, requestId);
      return getOrganizationAccount(id, effectiveInput.organizationId, client);
    });
  } catch (error) {
    throwAccountConflict(error);
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
  assertActorOrganization(actor, organizationId);
  return withTransaction(async (client) => {
    actor = await refreshHrisAccountActor(client, actor, organizationId);
    const before = await getOrganizationAccountForActor(id, organizationId, actor, client);
    assertActorCanManageAccount(actor, before.role_code);
    await client.query(
      "UPDATE users SET password_hash=$2,credential_version=credential_version+1,updated_at=now() WHERE id=$1",
      [id, await bcrypt.hash(password, 12)],
    );
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
