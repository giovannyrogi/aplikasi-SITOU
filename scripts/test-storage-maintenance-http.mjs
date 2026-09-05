import dotenv from "dotenv";
import pg from "pg";
import {
  createSessionToken,
  getSessionTtlSeconds,
  SESSION_COOKIE_NAME,
} from "../lib/auth/session.js";

dotenv.config({ path: process.env.ENV_FILE || ".env.development", quiet: true });

const baseUrl = process.env.APP_URL || "http://localhost:3000";
const pool = new pg.Pool({
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  port: Number(process.env.PGPORT || 5432),
});

async function sessionCookie(account) {
  const token = await createSessionToken({
    userId: account.user_id,
    roleCode: account.role_code,
    organizationId: account.organization_id,
    credentialVersion: account.credential_version,
    expiresAt: Date.now() + getSessionTtlSeconds() * 1000,
  });
  return `${SESSION_COOKIE_NAME}=${token}`;
}

async function request(pathname, account) {
  return fetch(`${baseUrl}${pathname}`, {
    headers: { cookie: await sessionCookie(account) },
  });
}

try {
  const accounts = await pool.query(
    `SELECT DISTINCT ON (role.code)
      user_account.id::text AS user_id,user_account.credential_version,
      role.code AS role_code,membership.organization_id::text
     FROM users user_account
     JOIN user_organization_roles membership ON membership.user_id=user_account.id
     JOIN roles role ON role.id=membership.role_id
     WHERE user_account.is_active=true AND role.code IN ('superadmin','hrd')
       AND membership.active_from<=CURRENT_DATE
       AND (membership.active_until IS NULL OR membership.active_until>=CURRENT_DATE)
     ORDER BY role.code,membership.id`,
  );
  const superadmin = accounts.rows.find((account) => account.role_code === "superadmin");
  const hrd = accounts.rows.find((account) => account.role_code === "hrd");
  if (!superadmin) throw new Error("Akun Superadmin aktif tidak tersedia untuk pengujian HTTP.");
  const organization = await pool.query("SELECT id::text FROM organizations ORDER BY id LIMIT 1");
  if (!organization.rows[0]) throw new Error("Organisasi belum tersedia untuk pengujian HTTP.");
  const query = `organizationId=${organization.rows[0].id}`;

  const summaryResponse = await request(
    `/api/system/storage-maintenance/summary?${query}`,
    superadmin,
  );
  const summaryBody = await summaryResponse.json();
  if (summaryResponse.status !== 200 || summaryBody.success !== true)
    throw new Error(`Superadmin gagal membaca ringkasan: HTTP ${summaryResponse.status}.`);

  const runsResponse = await request(`/api/system/storage-maintenance/runs?${query}`, superadmin);
  const runsBody = await runsResponse.json();
  if (runsResponse.status !== 200 || !Array.isArray(runsBody.data))
    throw new Error(`Superadmin gagal membaca riwayat: HTTP ${runsResponse.status}.`);

  let hrdStatus = "tidak diuji";
  if (hrd) {
    const denied = await request(`/api/system/storage-maintenance/summary?${query}`, hrd);
    if (denied.status !== 403)
      throw new Error(`HRD seharusnya ditolak, tetapi menerima HTTP ${denied.status}.`);
    hrdStatus = "ditolak 403";
  }

  console.log(
    JSON.stringify(
      {
        ready: true,
        superadminSummary: summaryResponse.status,
        superadminHistory: runsResponse.status,
        hrdAccess: hrdStatus,
        sensitiveFieldsExposed: ["object_key", "sha256"].some((key) => key in summaryBody.data),
      },
      null,
      2,
    ),
  );
} finally {
  await pool.end();
}
