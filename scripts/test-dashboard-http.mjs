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

/** Membuat cookie QA singkat tanpa memerlukan atau mencetak password akun development. */
async function createCookie(user) {
  const token = await createSessionToken({
    userId: String(user.id),
    roleCode: user.role_code,
    organizationId: user.organization_id ? String(user.organization_id) : null,
    credentialVersion: Number(user.credential_version),
    expiresAt: Date.now() + 10 * 60 * 1000,
  });
  return `${SESSION_COOKIE_NAME}=${token}`;
}

/** Memastikan endpoint dashboard mengembalikan kontrak visual yang lengkap. */
async function verifyDashboard(path, user, expectedScope) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { Cookie: await createCookie(user), Origin: baseUrl },
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`${user.role_code}: HTTP ${response.status}. ${payload.message || ""}`);
  }
  const data = payload.data;
  if (data.scope !== expectedScope || !Array.isArray(data.metrics) || !data.charts) {
    throw new Error(`${user.role_code}: kontrak respons dashboard tidak lengkap.`);
  }
  if (expectedScope === "organization") {
    const expectedCharts = [
      "growth",
      "locations",
      "units",
      "contracts",
      "completeness",
      "discipline",
    ];
    const missingChart = expectedCharts.find((key) => !data.charts[key]);
    if (missingChart) {
      throw new Error(`${user.role_code}: grafik ${missingChart} tidak tersedia.`);
    }
    const growthSeries = data.charts.growth.series?.map((series) => series.name);
    if (
      growthSeries?.length !== 2 ||
      growthSeries[0] !== "Pegawai baru" ||
      growthSeries[1] !== "Pegawai keluar"
    ) {
      throw new Error(`${user.role_code}: seri Perkembangan pegawai tidak sesuai.`);
    }
  }
  console.log(`OK ${user.role_code} (${data.scope}): ${data.metrics.length} metrik.`);
}

/** Mengambil satu akun aktif per role agar smoke test tetap read-only dan representatif. */
async function findActor(roleCode) {
  const result = await pool.query(
    `SELECT user_account.id,user_account.credential_version,role.code AS role_code,membership.organization_id
       FROM users user_account
       JOIN user_organization_roles membership ON membership.user_id=user_account.id
       JOIN roles role ON role.id=membership.role_id
      WHERE role.code=$1 AND user_account.is_active=true
        AND membership.active_from<=now()
        AND (membership.active_until IS NULL OR membership.active_until>now())
      ORDER BY user_account.id LIMIT 1`,
    [roleCode],
  );
  return result.rows[0] || null;
}

async function run() {
  try {
    const [superadmin, hrd, leader, organization] = await Promise.all([
      findActor("superadmin"),
      findActor("hrd"),
      findActor("leader"),
      pool
        .query("SELECT id FROM organizations WHERE is_active=true ORDER BY id LIMIT 1")
        .then((result) => result.rows[0] || null),
    ]);
    if (!superadmin) throw new Error("Akun Superadmin development aktif tidak ditemukan.");

    await verifyDashboard("/api/dashboard/summary?period=6m", superadmin, "platform");
    if (organization) {
      await verifyDashboard(
        `/api/dashboard/summary?period=12m&organizationId=${organization.id}`,
        superadmin,
        "organization",
      );
    }
    if (hrd) await verifyDashboard("/api/dashboard/summary?period=12m", hrd, "organization");
    if (leader) await verifyDashboard("/api/dashboard/summary?period=12m", leader, "organization");
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
