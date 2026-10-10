import pool from "@/lib/dbConfig";
import { ServiceError } from "@/lib/api/routeHelpers";
import { writeAudit } from "@/lib/audit";
import { HRIS_MENUS, accountCapabilities } from "./hrisPolicy.mjs";
/** Snapshot target dan actor tanpa mempercayai izin dari browser. */
export async function readHrisState(organizationId, membershipId, roleCode, database = pool) {
  if (roleCode !== "hrd")
    return {
      configured: true,
      fullAdmin: false,
      legacy: false,
      grants: [],
      assigned: [],
      version: 0,
      accountAccess: "none",
      canManageEmployeeAccounts: false,
      canDelegateEmployeeFeatures: false,
    };
  const policy = await database.query(
    `SELECT policy.enabled,policy.primary_membership_id::text,policy.version,settings.can_manage_employee_accounts,settings.can_delegate_employee_features
    FROM organizations organization LEFT JOIN organization_hris_access_policies policy ON policy.organization_id=organization.id
    LEFT JOIN user_hris_access_settings settings ON settings.organization_id=organization.id AND settings.membership_id=$2 WHERE organization.id=$1`,
    [organizationId, membershipId],
  );
  // Satu client transaksi tidak menjalankan query tumpang tindih.
  const grants = await database.query(
    "SELECT menu_code AS key,access_level AS level FROM user_hris_menu_grants WHERE organization_id=$1 AND membership_id=$2 ORDER BY menu_code",
    [organizationId, membershipId],
  );
  const configured = Boolean(policy.rows[0]?.enabled);
  const fullAdmin = configured && policy.rows[0].primary_membership_id === String(membershipId);
  const assigned = grants.rows;
  return {
    configured,
    fullAdmin,
    legacy: !configured,
    version: policy.rows[0]?.version || 0,
    primaryMembershipId: policy.rows[0]?.primary_membership_id || null,
    ...accountSettingsDto(policy.rows[0]),
    assigned,
    grants:
      fullAdmin || !configured
        ? HRIS_MENUS.map((m) => ({ key: m.key, level: m.canManage ? "manage" : "read" }))
        : assigned,
  };
}
/** Menyatukan mode API dengan flag SQL tanpa memberi delegasi implisit. */
function accountSettingsDto(row) {
  return {
    accountAccess: row?.can_delegate_employee_features
      ? "manage_and_delegate"
      : row?.can_manage_employee_accounts
        ? "manage"
        : "none",
    canManageEmployeeAccounts: Boolean(row?.can_manage_employee_accounts),
    canDelegateEmployeeFeatures: Boolean(row?.can_delegate_employee_features),
  };
}
/** Mengambil konteks actor yang aktif; identitas tetap berasal dari session server. */
export async function readActorHris(actor, database = pool) {
  return readHrisState(actor.organization_id, actor.role_assignment_id, actor.role_code, database);
}
/** Guard tambahan yang disetujui: admin harus dialihkan sebelum proses menonaktifkan akun/profil. */
export async function guardPrimaryHrisUser(database, organizationId, userId) {
  if (!userId) return;
  const owner = await database.query(
    `SELECT policy.primary_membership_id FROM organization_hris_access_policies policy
    JOIN user_organization_roles membership ON membership.organization_id=policy.organization_id AND membership.id=policy.primary_membership_id
    WHERE policy.organization_id=$1 AND policy.enabled AND membership.user_id=$2 FOR UPDATE OF policy`,
    [organizationId, userId],
  );
  if (owner.rowCount)
    throw new ServiceError(
      "HRIS_ADMIN_TRANSFER_REQUIRED",
      "Alihkan admin HRD penuh melalui Superadmin sebelum menonaktifkan akun atau profil ini.",
      409,
    );
}
/** Menyimpan grant dan penetapan admin di transaksi akun yang sama dengan version/audit. */
export async function applyHrisAccountAccess(
  database,
  account,
  input,
  actor,
  requestId,
  { created = false } = {},
) {
  const org = String(account.organization_id);
  await database.query("SELECT id FROM organizations WHERE id=$1 FOR NO KEY UPDATE", [org]);
  const policy = (
    await database.query(
      "SELECT enabled,primary_membership_id::text,version FROM organization_hris_access_policies WHERE organization_id=$1 FOR UPDATE",
      [org],
    )
  ).rows[0];
  const context = await readActorHris(actor, database);
  const primary = policy?.enabled && policy.primary_membership_id === String(account.membership_id);
  if (
    primary &&
    (!input.isActive ||
      input.roleCode !== "hrd" ||
      input.locationScopeMode !== "all" ||
      input.isHrisAdmin === false)
  )
    throw new ServiceError(
      "HRIS_ADMIN_TRANSFER_REQUIRED",
      "Alihkan admin HRD penuh sebelum mengubah role, cakupan, atau status akun ini.",
      409,
      { isHrisAdmin: "Admin penuh harus dialihkan melalui Superadmin." },
    );
  const count = (
    await database.query(
      `SELECT count(*)::int total FROM user_organization_roles membership JOIN roles role ON role.id=membership.role_id JOIN users account ON account.id=membership.user_id WHERE membership.organization_id=$1 AND role.code='hrd' AND account.is_active AND membership.active_from<=now() AND (membership.active_until IS NULL OR membership.active_until>now())`,
      [org],
    )
  ).rows[0].total;
  const first =
    created &&
    input.isActive &&
    input.roleCode === "hrd" &&
    count === 1 &&
    !policy?.enabled &&
    actor.role_code === "superadmin";
  const promote = input.isHrisAdmin === true || first;
  if (promote && !primary) {
    if (actor.role_code !== "superadmin")
      throw new ServiceError(
        "HRIS_ADMIN_SUPERADMIN_ONLY",
        "Hanya Superadmin dapat menetapkan admin HRD penuh.",
        403,
        { isHrisAdmin: "Penetapan admin penuh khusus Superadmin." },
      );
    if (input.roleCode !== "hrd" || !input.isActive)
      throw new ServiceError(
        "HRIS_ADMIN_INVALID",
        "Admin penuh harus memakai role HRD dan akun aktif.",
        400,
        { isHrisAdmin: "Gunakan akun HRD aktif." },
      );
    if (!first && input.hrisPolicyVersion !== (policy?.version || 0))
      throw new ServiceError(
        "VERSION_CONFLICT",
        "Penetapan admin telah berubah. Muat ulang formulir.",
        409,
        { isHrisAdmin: "Muat ulang penetapan admin organisasi." },
      );
    await database.query(
      "UPDATE user_organization_roles SET location_scope_mode='all',active_until=NULL WHERE organization_id=$1 AND id=$2",
      [org, account.membership_id],
    );
    input.locationScopeMode = "all";
    input.locationIds = [];
    await database.query(
      "DELETE FROM user_location_scopes WHERE organization_id=$1 AND user_organization_role_id=$2",
      [org, account.membership_id],
    );
    // Hak lama dipertahankan sebagai grant eksplisit saat pertama kali konfigurasi diaktifkan.
    if (!policy?.enabled)
      await database.query(
        `INSERT INTO user_hris_menu_grants(organization_id,membership_id,menu_code,access_level)
      SELECT membership.organization_id,membership.id,menu.code,CASE WHEN menu.can_manage THEN 'manage' ELSE 'read' END
      FROM user_organization_roles membership JOIN roles role ON role.id=membership.role_id CROSS JOIN hris_menu_definitions menu
      WHERE membership.organization_id=$1 AND role.code='hrd' AND membership.id<>$2
      AND NOT EXISTS(SELECT 1 FROM user_hris_access_settings settings WHERE settings.organization_id=membership.organization_id AND settings.membership_id=membership.id)
      ON CONFLICT DO NOTHING`,
        [org, account.membership_id],
      );
    await database.query(
      `INSERT INTO organization_hris_access_policies(organization_id,enabled,primary_membership_id,updated_by_user_id)
      VALUES($1,true,$2,$3) ON CONFLICT(organization_id) DO UPDATE SET enabled=true,primary_membership_id=EXCLUDED.primary_membership_id,version=organization_hris_access_policies.version+1,updated_at=now(),updated_by_user_id=EXCLUDED.updated_by_user_id`,
      [org, account.membership_id, actor.id],
    );
    await writeAudit(database, {
      organizationId: org,
      actorUserId: actor.id,
      action: "hris.admin.assign",
      entityType: "organization",
      entityId: org,
      beforeData: policy || null,
      afterData: { membershipId: String(account.membership_id) },
      requestId,
    });
  }
  if (input.hrisMenuAccess === undefined && input.hrisAccountAccess === undefined) return;
  if (actor.role_code !== "superadmin" && !context.fullAdmin)
    throw new ServiceError(
      "HRIS_DELEGATION_FORBIDDEN",
      "Hanya admin HRD penuh dapat mengatur akses menu HRD.",
      403,
    );
  if (input.roleCode !== "hrd" && input.hrisMenuAccess?.length)
    throw new ServiceError(
      "HRIS_ROLE_REQUIRED",
      "Hak administrasi HRIS hanya untuk akun role HRD.",
      400,
      { hrisMenuAccess: "Pilih role HRD." },
    );
  const before = await readHrisState(org, account.membership_id, input.roleCode, database);
  // Flag akun saja tidak boleh dianggap peninjauan menu legacy dan menghilangkan hak lama.
  if (
    input.hrisAccountAccess !== undefined &&
    input.hrisMenuAccess === undefined &&
    !before.configured &&
    input.roleCode === "hrd"
  )
    await database.query(
      `INSERT INTO user_hris_menu_grants(organization_id,membership_id,menu_code,access_level)
      SELECT $1,$2,menu.code,CASE WHEN menu.can_manage THEN 'manage' ELSE 'read' END FROM hris_menu_definitions menu
      WHERE NOT EXISTS(SELECT 1 FROM user_hris_access_settings settings WHERE settings.organization_id=$1 AND settings.membership_id=$2)
      ON CONFLICT DO NOTHING`,
      [org, account.membership_id],
    );
  if (input.hrisAccountAccess !== undefined) {
    if (input.roleCode !== "hrd" && input.hrisAccountAccess !== "none")
      throw new ServiceError(
        "HRIS_ROLE_REQUIRED",
        "Hak administrasi akun hanya untuk role HRD.",
        400,
        { hrisAccountAccess: "Pilih role HRD." },
      );
    await database.query(
      `INSERT INTO user_hris_access_settings(organization_id,membership_id,can_manage_employee_accounts,can_delegate_employee_features,updated_by_user_id)
      VALUES($1,$2,$3,$4,$5) ON CONFLICT(organization_id,membership_id) DO UPDATE SET can_manage_employee_accounts=EXCLUDED.can_manage_employee_accounts,can_delegate_employee_features=EXCLUDED.can_delegate_employee_features,updated_by_user_id=EXCLUDED.updated_by_user_id,updated_at=now()`,
      [
        org,
        account.membership_id,
        input.hrisAccountAccess !== "none",
        input.hrisAccountAccess === "manage_and_delegate",
        actor.id,
      ],
    );
    await writeAudit(database, {
      organizationId: org,
      actorUserId: actor.id,
      action: "hris.account_access.update",
      entityType: "membership",
      entityId: account.membership_id,
      beforeData: { accountAccess: before.accountAccess },
      afterData: { accountAccess: input.hrisAccountAccess },
      requestId,
    });
  }
  if (input.hrisMenuAccess === undefined) return;
  await database.query(
    "DELETE FROM user_hris_menu_grants WHERE organization_id=$1 AND membership_id=$2",
    [org, account.membership_id],
  );
  for (const grant of input.hrisMenuAccess)
    await database.query(
      "INSERT INTO user_hris_menu_grants(organization_id,membership_id,menu_code,access_level) VALUES($1,$2,$3,$4)",
      [org, account.membership_id, grant.key, grant.level],
    );
  await database.query(
    `INSERT INTO user_hris_access_settings(organization_id,membership_id,updated_by_user_id) VALUES($1,$2,$3) ON CONFLICT(organization_id,membership_id) DO UPDATE SET updated_at=now(),updated_by_user_id=EXCLUDED.updated_by_user_id`,
    [org, account.membership_id, actor.id],
  );
  await writeAudit(database, {
    organizationId: org,
    actorUserId: actor.id,
    action: "hris.menu.update",
    entityType: "membership",
    entityId: account.membership_id,
    beforeData: before.assigned,
    afterData: input.hrisMenuAccess,
    requestId,
  });
}

/** Batch DTO untuk daftar akun agar tidak menambah N+1. */
export async function readHrisStates(org, accounts, database = pool) {
  const ids = accounts.filter((a) => a.role_code === "hrd").map((a) => a.membership_id);
  if (!ids.length) return new Map();
  const [p, g, settings] = await Promise.all([
    database.query(
      "SELECT enabled,primary_membership_id::text,version FROM organization_hris_access_policies WHERE organization_id=$1",
      [org],
    ),
    database.query(
      "SELECT membership_id::text,menu_code AS key,access_level AS level FROM user_hris_menu_grants WHERE organization_id=$1 AND membership_id=ANY($2::bigint[])",
      [org, ids],
    ),
    database.query(
      "SELECT membership_id::text,can_manage_employee_accounts,can_delegate_employee_features FROM user_hris_access_settings WHERE organization_id=$1 AND membership_id=ANY($2::bigint[])",
      [org, ids],
    ),
  ]);
  const policy = p.rows[0];
  const result = new Map();
  for (const id of ids) {
    const assigned = g.rows
      .filter((row) => row.membership_id === String(id))
      .map(({ key, level }) => ({ key, level }));
    const fullAdmin = Boolean(policy?.enabled && policy.primary_membership_id === String(id));
    result.set(String(id), {
      configured: Boolean(policy?.enabled),
      fullAdmin,
      legacy: !policy?.enabled,
      version: policy?.version || 0,
      ...accountSettingsDto(settings.rows.find((row) => row.membership_id === String(id))),
      assigned,
      grants:
        fullAdmin || !policy?.enabled
          ? HRIS_MENUS.map((m) => ({ key: m.key, level: m.canManage ? "manage" : "read" }))
          : assigned,
    });
  }
  return result;
}
/** Mengunci kewenangan akun lagi di transaksi agar pencabutan tidak dilangkahi request lama. */
export async function refreshHrisAccountActor(database, actor, org) {
  await database.query("SELECT id FROM organizations WHERE id=$1 FOR NO KEY UPDATE", [org]);
  const hrisContext = await readActorHris(actor, database);
  if (!accountCapabilities({ ...actor, hrisContext }).canManageAccounts)
    throw new ServiceError(
      "HRIS_DELEGATION_FORBIDDEN",
      "Izin mengelola akun Pegawai belum diberikan.",
      403,
    );
  return { ...actor, hrisContext };
}
