const dotenv = require("dotenv");
const { Pool } = require("pg");

dotenv.config({ path: ".env.development" });

const baseUrl = process.env.SITOU_TEST_BASE_URL || "http://localhost:3000";
const superadminUsername = process.env.SITOU_TEST_SUPERADMIN_USERNAME || "superadmin";
const superadminPassword = process.env.SITOU_TEST_SUPERADMIN_PASSWORD;

if (!superadminPassword) {
  throw new Error("SITOU_TEST_SUPERADMIN_PASSWORD wajib diisi untuk HTTP test.");
}

const pool = new Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
});

const created = { organizationId: null, locationId: null, userId: null };

async function request(path, { method = "GET", cookie, body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Origin: baseUrl,
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const rawBody = await response.text();
  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    throw new Error(
      `${method} ${path}: respons bukan JSON (HTTP ${response.status}). ${rawBody.slice(0, 200)}`,
    );
  }
  return { response, payload };
}

function expectStatus(result, expected, step) {
  if (result.response.status !== expected) {
    throw new Error(
      `${step}: HTTP ${result.response.status}, expected ${expected}. ${result.payload.message || ""}`,
    );
  }
}

async function login(username, password) {
  const result = await request("/api/auth/login", {
    method: "POST",
    body: { username, password },
  });
  expectStatus(result, 200, `Login ${username}`);
  return result.response.headers.get("set-cookie").split(";", 1)[0];
}

async function cleanup() {
  if (!created.organizationId) return;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM audit_logs WHERE organization_id=$1", [created.organizationId]);
    if (created.userId) {
      await client.query("DELETE FROM audit_logs WHERE actor_user_id=$1", [created.userId]);
      await client.query("DELETE FROM users WHERE id=$1", [created.userId]);
    }
    await client.query("DELETE FROM locations WHERE organization_id=$1", [created.organizationId]);
    await client.query("DELETE FROM organizations WHERE id=$1", [created.organizationId]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function run() {
  const suffix = Date.now().toString(36).toUpperCase();
  const adminUsername = `qa.admin.${suffix.toLowerCase()}`;
  const adminPassword = `Qa!${suffix}a9_secure`;
  const superadminCookie = await login(superadminUsername, superadminPassword);

  const invalid = await request("/api/organizations", {
    method: "POST",
    cookie: superadminCookie,
    body: { code: `QA${suffix}`, name: "QA tanpa masa berlaku" },
  });
  expectStatus(invalid, 400, "Validasi organisasi");

  const organization = await request("/api/organizations", {
    method: "POST",
    cookie: superadminCookie,
    body: {
      code: `QA${suffix}`,
      name: `QA Organization ${suffix}`,
      legalName: null,
      organizationType: "company",
      parentId: null,
      timezone: "Asia/Makassar",
      activeFrom: new Date().toISOString().slice(0, 10),
      activeUntil: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
      isActive: true,
    },
  });
  expectStatus(organization, 201, "Create organisasi");
  created.organizationId = organization.payload.data.id;

  const organizationUpdate = await request(`/api/organizations/${created.organizationId}`, {
    method: "PATCH",
    cookie: superadminCookie,
    body: {
      code: `QA${suffix}`,
      name: `QA Organization Updated ${suffix}`,
      legalName: null,
      organizationType: "company",
      parentId: null,
      timezone: "Asia/Makassar",
      activeFrom: organization.payload.data.active_from,
      activeUntil: organization.payload.data.active_until,
      isActive: true,
      version: new Date(organization.payload.data.updated_at).toISOString(),
    },
  });
  expectStatus(organizationUpdate, 200, "Update organisasi");

  const location = await request("/api/locations", {
    method: "POST",
    cookie: superadminCookie,
    body: {
      organizationId: created.organizationId,
      parentLocationId: null,
      code: "PUSAT",
      name: "Kantor QA",
      locationType: "market",
      address: null,
      latitude: null,
      longitude: null,
      activeFrom: new Date().toISOString().slice(0, 10),
      activeUntil: null,
      isActive: true,
    },
  });
  expectStatus(location, 201, "Create lokasi");
  created.locationId = location.payload.data.id;

  const locationUpdate = await request(`/api/locations/${created.locationId}`, {
    method: "PATCH",
    cookie: superadminCookie,
    body: {
      organizationId: created.organizationId,
      parentLocationId: null,
      code: "PUSAT",
      name: "Kantor QA Updated",
      locationType: "market",
      address: null,
      latitude: null,
      longitude: null,
      activeFrom: location.payload.data.active_from,
      activeUntil: null,
      isActive: true,
      version: new Date(location.payload.data.updated_at).toISOString(),
    },
  });
  expectStatus(locationUpdate, 200, "Update lokasi");

  const admin = await request("/api/admin-users", {
    method: "POST",
    cookie: superadminCookie,
    body: {
      username: adminUsername,
      email: `${adminUsername}@sitou.local`,
      fullName: "QA Admin SITOU",
      phone: null,
      password: adminPassword,
      organizationId: created.organizationId,
      locationIds: [created.locationId],
      isActive: true,
    },
  });
  expectStatus(admin, 201, "Create Admin/HRD");
  created.userId = admin.payload.data.id;

  const adminUpdate = await request(`/api/admin-users/${created.userId}`, {
    method: "PATCH",
    cookie: superadminCookie,
    body: {
      username: adminUsername,
      email: `${adminUsername}@sitou.local`,
      fullName: "QA Admin SITOU Updated",
      phone: null,
      locationIds: [created.locationId],
      isActive: true,
      version: new Date(admin.payload.data.updated_at).toISOString(),
    },
  });
  expectStatus(adminUpdate, 200, "Update Admin/HRD");

  const adminCookie = await login(adminUsername, adminPassword);
  const forbidden = await request("/api/organizations", { cookie: adminCookie });
  expectStatus(forbidden, 403, "Pembatasan API Superadmin");

  const protectedLocation = await request(`/api/locations/${created.locationId}`, {
    method: "DELETE",
    cookie: superadminCookie,
  });
  expectStatus(protectedLocation, 409, "Guard lokasi akses terakhir");

  const adminList = await request(
    `/api/admin-users?organizationId=${created.organizationId}&page=1&pageSize=10`,
    { cookie: superadminCookie },
  );
  expectStatus(adminList, 200, "List Admin/HRD");
  if (!adminList.payload.data.some((item) => item.id === String(created.userId))) {
    throw new Error("Admin/HRD hasil create tidak ditemukan pada list.");
  }

  const resetPassword = `${adminPassword}X!`;
  const passwordUpdate = await request(`/api/admin-users/${created.userId}/password`, {
    method: "PATCH",
    cookie: superadminCookie,
    body: { password: resetPassword },
  });
  expectStatus(passwordUpdate, 200, "Reset password Admin/HRD");
  await login(adminUsername, resetPassword);

  const adminDeactivate = await request(`/api/admin-users/${created.userId}`, {
    method: "DELETE",
    cookie: superadminCookie,
  });
  expectStatus(adminDeactivate, 200, "Deactivate Admin/HRD");
  const inactiveLogin = await request("/api/auth/login", {
    method: "POST",
    body: { username: adminUsername, password: resetPassword },
  });
  expectStatus(inactiveLogin, 403, "Login akun nonaktif");

  const locationDeactivate = await request(`/api/locations/${created.locationId}`, {
    method: "DELETE",
    cookie: superadminCookie,
  });
  expectStatus(locationDeactivate, 200, "Deactivate lokasi");

  const organizationDeactivate = await request(`/api/organizations/${created.organizationId}`, {
    method: "DELETE",
    cookie: superadminCookie,
  });
  expectStatus(organizationDeactivate, 200, "Deactivate organisasi");

  console.log(
    "HTTP master-data test lulus: CRUD lengkap, login HRD, authorization, password, dan guard lokasi.",
  );
}

run()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await cleanup();
    } catch (error) {
      console.error(`Cleanup gagal: ${error.message}`);
      process.exitCode = 1;
    }
    await pool.end();
  });
