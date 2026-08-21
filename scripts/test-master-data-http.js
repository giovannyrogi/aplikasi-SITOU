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

async function request(path, { method = "GET", cookie, body, requestId } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Origin: baseUrl,
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(requestId ? { "X-Request-ID": requestId } : {}),
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
    await client.query("DELETE FROM organization_subscriptions WHERE organization_id=$1", [
      created.organizationId,
    ]);
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
      initialSubscription: {
        startsOn: new Date().toISOString().slice(0, 10),
        endsOn: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
        graceEndsOn: null,
        notes: "Periode QA",
      },
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
      isActive: true,
      version: new Date(organization.payload.data.updated_at).toISOString(),
    },
  });
  expectStatus(organizationUpdate, 200, "Update organisasi");

  const subscriptions = await request(
    `/api/organizations/${created.organizationId}/subscriptions`,
    { cookie: superadminCookie },
  );
  expectStatus(subscriptions, 200, "Histori langganan");
  if (subscriptions.payload.data.length !== 1) throw new Error("Langganan awal tidak terbentuk.");

  const renewalRequestId = crypto.randomUUID();
  const renewalBody = {
    startsOn: new Date(Date.now() + 366 * 86400000).toISOString().slice(0, 10),
    endsOn: new Date(Date.now() + 730 * 86400000).toISOString().slice(0, 10),
    graceEndsOn: null,
    notes: "Perpanjangan QA",
  };
  const renewal = await request(`/api/organizations/${created.organizationId}/subscriptions`, {
    method: "POST",
    cookie: superadminCookie,
    requestId: renewalRequestId,
    body: renewalBody,
  });
  expectStatus(renewal, 201, "Perpanjangan langganan");
  const duplicateRenewal = await request(
    `/api/organizations/${created.organizationId}/subscriptions`,
    { method: "POST", cookie: superadminCookie, requestId: renewalRequestId, body: renewalBody },
  );
  expectStatus(duplicateRenewal, 201, "Retry perpanjangan idempotent");
  const overlap = await request(`/api/organizations/${created.organizationId}/subscriptions`, {
    method: "POST",
    cookie: superadminCookie,
    body: renewalBody,
  });
  expectStatus(overlap, 409, "Periode langganan overlap");

  const suspend = await request(
    `/api/organizations/${created.organizationId}/subscriptions/${renewal.payload.data.id}`,
    {
      method: "PATCH",
      cookie: superadminCookie,
      body: {
        action: "suspend",
        reason: "Pengujian suspend periode",
        version: new Date(renewal.payload.data.updated_at).toISOString(),
      },
    },
  );
  expectStatus(suspend, 200, "Suspend langganan");
  const restore = await request(
    `/api/organizations/${created.organizationId}/subscriptions/${renewal.payload.data.id}`,
    {
      method: "PATCH",
      cookie: superadminCookie,
      body: {
        action: "restore",
        reason: "Pengujian restore periode",
        version: new Date(suspend.payload.data.updated_at).toISOString(),
      },
    },
  );
  expectStatus(restore, 200, "Restore langganan");

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
      operationalFrom: new Date().toISOString().slice(0, 10),
      operationalUntil: null,
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
      operationalFrom: location.payload.data.operational_from,
      operationalUntil: null,
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

  const adminList = await request(
    `/api/admin-users?organizationId=${created.organizationId}&page=1&pageSize=10`,
    { cookie: superadminCookie },
  );
  expectStatus(adminList, 200, "List Admin/HRD");
  if (!adminList.payload.data.some((item) => item.id === String(created.userId))) {
    throw new Error("Admin/HRD hasil create tidak ditemukan pada list.");
  }

  const resetPassword = adminPassword + "X!";
  const passwordMismatch = await request("/api/admin-users/" + created.userId + "/password", {
    method: "PATCH",
    cookie: superadminCookie,
    body: { password: resetPassword, confirmPassword: resetPassword + "beda" },
  });
  expectStatus(passwordMismatch, 400, "Tolak konfirmasi password berbeda");
  if (!passwordMismatch.payload.fieldErrors?.confirmPassword) {
    throw new Error("Error konfirmasi password tidak dikembalikan.");
  }

  const passwordUpdate = await request("/api/admin-users/" + created.userId + "/password", {
    method: "PATCH",
    cookie: superadminCookie,
    body: { password: resetPassword, confirmPassword: resetPassword },
  });
  expectStatus(passwordUpdate, 200, "Reset password Admin/HRD");
  await login(adminUsername, resetPassword);

  const deactivatedLocation = await request("/api/locations/" + created.locationId, {
    method: "DELETE",
    cookie: superadminCookie,
  });
  expectStatus(deactivatedLocation, 200, "Nonaktifkan lokasi akses terakhir");
  const inactiveLocationLogin = await request("/api/auth/login", {
    method: "POST",
    body: { username: adminUsername, password: resetPassword },
  });
  expectStatus(inactiveLocationLogin, 403, "Tolak login tanpa lokasi operasional aktif");
  if (inactiveLocationLogin.payload.code !== "LOCATION_SCOPE_INACTIVE") {
    throw new Error(
      "Kode login lokasi nonaktif tidak sesuai: " + inactiveLocationLogin.payload.code,
    );
  }
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
    "HTTP master-data test lulus: CRUD lengkap, login HRD, authorization, konfirmasi password, dan kontrol lokasi nonaktif.",
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
