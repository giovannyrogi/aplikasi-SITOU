import { createHash, randomBytes } from "node:crypto";
import pool from "@/lib/dbConfig";
import { verifyLoginCredentials } from "../credentialService";
import { clearLoginFailures } from "../loginRateLimit";
import { recordSuccessfulLogin } from "../userRepository";
import { LoginError } from "../loginError";
import { findMobileUser } from "./userRepository";
import { mobileAccessFailure, mobileUserPayload } from "./policy.mjs";
import { getMobileSessionTtlMinutes } from "./config.mjs";

const SESSION_MESSAGE = "Sesi berakhir. Silakan masuk kembali.";
const hash = (value) => createHash("sha256").update(value).digest("hex");

/** Token opaque bertipe khusus tidak dapat dipakai sebagai cookie web. */
export function mobileBearerToken(request) {
  const match = /^Bearer (sm1_[A-Za-z0-9_-]{43})$/.exec(request.headers.get("authorization") || "");
  return match?.[1] || null;
}

/** Kredensial dan audit bersama; penerbitan sesi dan audit berada dalam satu transaksi. */
export async function loginMobile(input, metadata) {
  const sessionTtlMinutes = getMobileSessionTtlMinutes();
  const user = await verifyLoginCredentials(
    { ...input, ipAddress: metadata.ipAddress },
    {
      findUser: findMobileUser,
      specificErrors: true,
    },
  );
  const failure = mobileAccessFailure(user);
  if (failure) throw new LoginError(failure.code, failure.message, 403);
  const token = "sm1_" + randomBytes(32).toString("base64url");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Mengunci akun agar penerbitan tidak melewati perubahan password/nonaktif paralel.
    const locked = await client.query(
      "SELECT is_active,credential_version FROM users WHERE id=$1 FOR UPDATE",
      [user.id],
    );
    if (!locked.rows[0]?.is_active || locked.rows[0].credential_version !== user.credential_version)
      throw new LoginError("UNAUTHENTICATED", SESSION_MESSAGE, 401);
    const { rows } = await client.query(
      `INSERT INTO mobile_auth_sessions
      (organization_id,user_id,employee_id,role_assignment_id,credential_version,token_hash,expires_at)
      VALUES($1,$2,$3,$4,$5,$6,now()+($7::integer * interval '1 minute')) RETURNING expires_at`,
      [
        user.organization_id,
        user.id,
        user.employee_id,
        user.role_assignment_id,
        user.credential_version,
        hash(token),
        sessionTtlMinutes,
      ],
    );
    await recordSuccessfulLogin({ user, ...metadata }, client);
    await client.query(
      `INSERT INTO audit_logs(organization_id,actor_user_id,action,entity_type,entity_id,request_id)
      VALUES($1,$2,'auth.mobile.login','user',$3,$4::uuid)`,
      [user.organization_id, user.id, String(user.id), metadata.requestId],
    );
    await client.query("COMMIT");
    await clearLoginFailures(metadata.ipAddress, input.username);
    return {
      token,
      tokenType: "Bearer",
      expiresAt: rows[0].expires_at.toISOString(),
      user: mobileUserPayload(user),
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

/** Pemeriksaan semua request mobile selalu membaca kelayakan server terkini. */
export async function requireMobileUser(request, { write = false } = {}) {
  const token = mobileBearerToken(request);
  if (!token) throw new LoginError("UNAUTHENTICATED", SESSION_MESSAGE, 401);
  const { rows } = await pool.query(
    "SELECT *,expires_at<=now() AS expired FROM mobile_auth_sessions WHERE token_hash=$1",
    [hash(token)],
  );
  const session = rows[0];
  if (!session || session.revoked_at || session.expired)
    throw new LoginError("UNAUTHENTICATED", SESSION_MESSAGE, 401);
  const user = await findMobileUser(session.user_id, { byId: true });
  const failure = mobileAccessFailure(user);
  const matches =
    user &&
    String(user.employee_id) === String(session.employee_id) &&
    String(user.organization_id) === String(session.organization_id) &&
    String(user.role_assignment_id) === String(session.role_assignment_id) &&
    Number(user.credential_version) === Number(session.credential_version);
  if (failure || !matches) {
    await pool.query(
      "UPDATE mobile_auth_sessions SET revoked_at=COALESCE(revoked_at,now()) WHERE id=$1",
      [session.id],
    );
    if (failure) throw new LoginError(failure.code, failure.message, 403);
    throw new LoginError("UNAUTHENTICATED", SESSION_MESSAGE, 401);
  }
  if (write && user.employment_status === "suspended")
    throw new LoginError("MOBILE_READ_ONLY", "Akun hanya memiliki akses baca.", 403);
  return { user: mobileUserPayload(user), expiresAt: session.expires_at.toISOString() };
}

/** Logout berulang tetap berhasil dan hanya menyentuh hash sesi yang dikirim. */
export async function logoutMobile(request, metadata) {
  const token = mobileBearerToken(request);
  if (!token) return;
  const { rows } = await pool.query(
    `UPDATE mobile_auth_sessions SET revoked_at=now()
    WHERE token_hash=$1 AND revoked_at IS NULL RETURNING id,user_id,organization_id`,
    [hash(token)],
  );
  if (rows[0])
    await pool.query(
      `INSERT INTO audit_logs(organization_id,actor_user_id,action,entity_type,entity_id,request_id)
    VALUES($1,$2,'auth.mobile.logout','mobile_auth_session',$3,$4::uuid)`,
      [rows[0].organization_id, rows[0].user_id, String(rows[0].id), metadata.requestId],
    );
}
