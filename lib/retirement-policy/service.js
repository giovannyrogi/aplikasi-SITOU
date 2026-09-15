import pool from "@/lib/dbConfig";
import { resolvePermissionOrganization } from "@/lib/auth/permissions";
import { ServiceError } from "@/lib/api/routeHelpers";
import { writeAudit } from "@/lib/audit";
import { validReportId } from "@/lib/reports/policy.mjs";

/** Guard service tetap berlaku meskipun dipanggil dari endpoint lain. */
async function context(database, actor, requestedId, manage = false) {
  const organizationId = resolvePermissionOrganization(actor, requestedId);
  if (!validReportId(organizationId))
    throw new ServiceError("ORGANIZATION_REQUIRED", "Pilih organisasi yang valid.", 400);
  const roles = manage ? ["superadmin", "hrd"] : ["superadmin", "hrd", "leader"];
  const permission = manage ? "retirement_policy.manage" : "retirement_policy.read";
  const allowed = await database.query(
    `SELECT 1 FROM role_permissions rp JOIN roles r ON r.id=rp.role_id JOIN permissions p ON p.id=rp.permission_id WHERE r.code=$1 AND p.code=$2`,
    [actor.role_code, permission],
  );
  if (!roles.includes(actor.role_code) || !allowed.rowCount)
    throw new ServiceError(
      "RETIREMENT_POLICY_FORBIDDEN",
      "Akun Anda tidak memiliki izin untuk pengaturan kebijakan pensiun ini.",
      403,
    );
  const result = await database.query(
    "SELECT id::text,name FROM organizations WHERE id=$1 AND is_active=true",
    [organizationId],
  );
  if (!result.rowCount)
    throw new ServiceError("ORGANIZATION_NOT_FOUND", "Organisasi aktif tidak ditemukan.", 404);
  return result.rows[0];
}

/** Riwayat berasal dari audit tersimpan, termasuk pelaku yang sudah tidak aktif. */
export async function getRetirementPolicy(actor, requestedId) {
  const organization = await context(pool, actor, requestedId);
  const policy = await pool.query(
    `SELECT p.retirement_age,p.version,p.updated_at,p.change_reason,COALESCE(v.display_name,u.username,'Inisialisasi sistem') AS updated_by FROM organization_retirement_policies p LEFT JOIN users u ON u.id=p.updated_by_user_id LEFT JOIN v_user_identity v ON v.user_id=u.id WHERE p.organization_id=$1`,
    [organization.id],
  );
  const history = await pool.query(
    `SELECT a.id::text,a.occurred_at,a.before_data,a.after_data,COALESCE(v.display_name,u.username,'Akun tidak tersedia') AS actor_name FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_user_id LEFT JOIN v_user_identity v ON v.user_id=u.id WHERE a.organization_id=$1 AND a.action='retirement_policy.update' ORDER BY a.occurred_at DESC,a.id DESC LIMIT 20`,
    [organization.id],
  );
  const permission = await pool.query(
    `SELECT 1 FROM role_permissions rp JOIN roles r ON r.id=rp.role_id JOIN permissions p ON p.id=rp.permission_id WHERE r.code=$1 AND p.code='retirement_policy.manage'`,
    [actor.role_code],
  );
  return {
    organization,
    policy: policy.rows[0] || null,
    history: history.rows,
    canManage: ["superadmin", "hrd"].includes(actor.role_code) && !!permission.rowCount,
  };
}

/** Lock organisasi juga melindungi pembuatan kebijakan pertama dari dua penyimpanan bersamaan. */
export async function saveRetirementPolicy(actor, requestedId, input, requestId) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const organization = await context(client, actor, requestedId, true);
    await client.query("SELECT id FROM organizations WHERE id=$1 FOR UPDATE", [organization.id]);
    const previous = (
      await client.query(
        "SELECT retirement_age,version FROM organization_retirement_policies WHERE organization_id=$1",
        [organization.id],
      )
    ).rows[0];
    if ((previous?.version || 0) !== input.version)
      throw new ServiceError(
        "RETIREMENT_POLICY_CONFLICT",
        "Kebijakan telah diubah pengguna lain. Muat ulang lalu periksa usia pensiun sebelum menyimpan kembali.",
        409,
      );
    if (previous?.retirement_age === input.retirementAge)
      throw new ServiceError(
        "RETIREMENT_POLICY_UNCHANGED",
        "Usia pensiun belum berubah. Masukkan usia baru untuk menyimpan perubahan.",
        400,
        { retirementAge: "Usia pensiun sama dengan kebijakan yang tersimpan." },
      );
    await client.query(
      `INSERT INTO organization_retirement_policies(organization_id,retirement_age,updated_by_user_id,change_reason) VALUES ($1,$2,$3,$4) ON CONFLICT (organization_id) DO UPDATE SET retirement_age=EXCLUDED.retirement_age,version=organization_retirement_policies.version+1,updated_at=now(),updated_by_user_id=EXCLUDED.updated_by_user_id,change_reason=EXCLUDED.change_reason`,
      [organization.id, input.retirementAge, actor.id, input.reason],
    );
    await writeAudit(client, {
      organizationId: organization.id,
      actorUserId: actor.id,
      action: "retirement_policy.update",
      entityType: "organization_retirement_policy",
      entityId: organization.id,
      beforeData: previous || null,
      afterData: {
        retirement_age: input.retirementAge,
        reason: input.reason,
        version: input.version + 1,
      },
      requestId,
    });
    await client.query("COMMIT");
    return { saved: true };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
