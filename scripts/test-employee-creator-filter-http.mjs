import assert from "node:assert/strict";
import dotenv from "dotenv";
import pg from "pg";
import { createSessionToken, SESSION_COOKIE_NAME } from "../lib/auth/session.js";

dotenv.config({ path: ".env.development", quiet: true });

const baseUrl = process.env.SITOU_TEST_BASE_URL || "http://localhost:3000";
const pool = new pg.Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
});

/** Menguji bahwa opsi dan daftar memakai audit pencatatan yang sama tanpa mencetak data pegawai. */
try {
  const {
    rows: [actor],
  } = await pool.query(
    `SELECT user_account.id,user_account.credential_version,role.code AS role_code,membership.organization_id
     FROM users user_account
     JOIN user_organization_roles membership ON membership.user_id=user_account.id
     JOIN roles role ON role.id=membership.role_id
     WHERE role.code IN ('hrd','leader') AND user_account.is_active=true
       AND membership.active_from<=now() AND (membership.active_until IS NULL OR membership.active_until>now())
     ORDER BY role.code='hrd' DESC,user_account.id LIMIT 1`,
  );
  assert.ok(actor, "Akun HRD atau Pimpinan lokal diperlukan untuk uji filter pembuat.");
  const token = await createSessionToken({
    userId: String(actor.id),
    roleCode: actor.role_code,
    organizationId: String(actor.organization_id),
    credentialVersion: Number(actor.credential_version),
    expiresAt: Date.now() + 10 * 60 * 1000,
  });
  const headers = { Cookie: `${SESSION_COOKIE_NAME}=${token}`, Origin: baseUrl };
  const optionsResponse = await fetch(
    `${baseUrl}/api/employees/reference-options?organizationId=${actor.organization_id}`,
    { headers },
  );
  const options = await optionsResponse.json();
  assert.equal(optionsResponse.status, 200);
  assert.ok(Array.isArray(options.data.createdByUsers));
  const creator = options.data.createdByUsers[0];
  if (creator) {
    const response = await fetch(
      `${baseUrl}/api/employees?organizationId=${actor.organization_id}&createdByUserId=${creator.id}&page=1&pageSize=10`,
      { headers },
    );
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.ok(Array.isArray(body.data));
  }
  const invalid = await fetch(
    `${baseUrl}/api/employees?organizationId=${actor.organization_id}&createdByUserId=invalid`,
    { headers },
  );
  assert.equal(invalid.status, 400);
  console.log("PASS filter akun pencatat pegawai: opsi, daftar, dan validasi API.");
} finally {
  await pool.end();
}
