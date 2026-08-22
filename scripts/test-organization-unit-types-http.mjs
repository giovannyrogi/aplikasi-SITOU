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
const created = { typeId: null, unitId: null };

/** Membuat cookie QA dari user development aktif tanpa mengekspos kredensial login. */
async function createCookie(user) {
  const token = await createSessionToken({
    userId: String(user.id),
    roleCode: user.role_code,
    organizationId: user.organization_id ? String(user.organization_id) : null,
    expiresAt: Date.now() + 10 * 60 * 1000,
  });
  return `${SESSION_COOKIE_NAME}=${token}`;
}

/** Memanggil route lokal dan mengurai kontrak JSON secara konsisten. */
async function request(path, { method = "GET", cookie, body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Origin: baseUrl,
      Cookie: cookie,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { response, payload: await response.json() };
}

/** Menghentikan QA dengan detail respons publik bila status tidak sesuai. */
function expectStatus(result, expected, step) {
  if (result.response.status !== expected)
    throw new Error(
      `${step}: HTTP ${result.response.status}, expected ${expected}. ${result.payload.message || ""}`,
    );
}

/** Membersihkan record sintetis tanpa menyentuh master organisasi development. */
async function cleanup() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (created.unitId) {
      await client.query("DELETE FROM organization_unit_locations WHERE organization_unit_id=$1", [
        created.unitId,
      ]);
      await client.query("DELETE FROM organization_units WHERE id=$1", [created.unitId]);
      await client.query(
        "DELETE FROM audit_logs WHERE entity_type='organization_unit' AND entity_id=$1",
        [created.unitId],
      );
    }
    if (created.typeId) {
      await client.query("DELETE FROM organization_unit_types WHERE id=$1", [created.typeId]);
      await client.query(
        "DELETE FROM audit_logs WHERE entity_type='organization_unit_type' AND entity_id=$1",
        [created.typeId],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/** Menjalankan skenario CRUD, aturan jenis nonaktif, dan isolasi organisasi. */
async function run() {
  const client = await pool.connect();
  let superadmin;
  let hrd;
  let organizations;
  try {
    superadmin = (
      await client.query(
        `SELECT user_account.id,role.code AS role_code,NULL::bigint AS organization_id
          FROM users user_account
          JOIN user_organization_roles membership ON membership.user_id=user_account.id
          JOIN roles role ON role.id=membership.role_id
          WHERE role.code='superadmin' AND user_account.is_active=true
          AND membership.active_from<=now()
          AND (membership.active_until IS NULL OR membership.active_until>now()) LIMIT 1`,
      )
    ).rows[0];
    hrd = (
      await client.query(
        `SELECT user_account.id,role.code AS role_code,membership.organization_id
          FROM users user_account
          JOIN user_organization_roles membership ON membership.user_id=user_account.id
          JOIN roles role ON role.id=membership.role_id
          WHERE role.code='hrd' AND user_account.is_active=true
          AND membership.active_from<=now()
          AND (membership.active_until IS NULL OR membership.active_until>now())
          AND membership.organization_id IS NOT NULL LIMIT 1`,
      )
    ).rows[0];
    organizations = (
      await client.query(
        "SELECT id::text FROM organizations WHERE is_active=true ORDER BY id LIMIT 3",
      )
    ).rows;
  } finally {
    client.release();
  }
  if (!superadmin || !organizations.length)
    throw new Error("Superadmin dan minimal satu organisasi aktif diperlukan untuk HTTP QA.");

  const cookie = await createCookie(superadmin);
  const organizationId = organizations[0].id;
  const suffix = Date.now().toString(36).toUpperCase();
  const type = await request("/api/organization-unit-types", {
    method: "POST",
    cookie,
    body: {
      organizationId,
      code: `QA_TYPE_${suffix}`,
      name: `Jenis Unit QA ${suffix}`,
      description: "Data sintetis pengujian HTTP.",
      sortOrder: 900,
      isActive: true,
    },
  });
  expectStatus(type, 201, "Create jenis unit");
  created.typeId = type.payload.data.id;

  const listedType = await request(
    `/api/organization-unit-types?organizationId=${organizationId}&search=${encodeURIComponent(suffix)}`,
    { cookie },
  );
  expectStatus(listedType, 200, "List jenis unit");
  if (!listedType.payload.data.some((item) => item.id === created.typeId))
    throw new Error("List jenis unit tidak memuat record yang baru dibuat.");

  const activeOptions = await request(
    `/api/organization-unit-types/options?organizationId=${organizationId}`,
    { cookie },
  );
  expectStatus(activeOptions, 200, "Options jenis unit aktif");
  if (!activeOptions.payload.data.some((item) => item.id === created.typeId))
    throw new Error("Options jenis unit tidak memuat jenis aktif yang baru dibuat.");

  const staleUpdate = await request(`/api/organization-unit-types/${created.typeId}`, {
    method: "PATCH",
    cookie,
    body: {
      organizationId,
      code: type.payload.data.code,
      name: type.payload.data.name,
      description: type.payload.data.description,
      sortOrder: type.payload.data.sort_order,
      isActive: true,
      version: "2000-01-01T00:00:00.000Z",
    },
  });
  expectStatus(staleUpdate, 409, "Tolak versi edit lama");

  const duplicate = await request("/api/organization-unit-types", {
    method: "POST",
    cookie,
    body: {
      organizationId,
      code: `QA_DUP_${suffix}`,
      name: `Jenis Unit QA ${suffix}`,
      description: null,
      sortOrder: 901,
      isActive: true,
    },
  });
  expectStatus(duplicate, 409, "Tolak nama duplikat");

  const unit = await request("/api/organization-units", {
    method: "POST",
    cookie,
    body: {
      organizationId,
      parentUnitId: null,
      code: `QA_UNIT_${suffix}`,
      name: `Unit QA ${suffix}`,
      unitTypeId: created.typeId,
      locationIds: [],
      isActive: true,
    },
  });
  expectStatus(unit, 201, "Create unit dengan type ID");
  created.unitId = unit.payload.data.id;

  const lockedCode = await request(`/api/organization-unit-types/${created.typeId}`, {
    method: "PATCH",
    cookie,
    body: {
      organizationId,
      code: `QA_CHANGED_${suffix}`,
      name: type.payload.data.name,
      description: type.payload.data.description,
      sortOrder: type.payload.data.sort_order,
      isActive: true,
      version: type.payload.data.updated_at,
    },
  });
  expectStatus(lockedCode, 409, "Kunci kode terpakai");

  const deactivated = await request(`/api/organization-unit-types/${created.typeId}`, {
    method: "DELETE",
    cookie,
  });
  expectStatus(deactivated, 200, "Nonaktifkan jenis unit");

  const inactiveOptions = await request(
    `/api/organization-unit-types/options?organizationId=${organizationId}&includeId=${created.typeId}`,
    { cookie },
  );
  expectStatus(inactiveOptions, 200, "Pertahankan options jenis unit nonaktif");
  const inactiveOption = inactiveOptions.payload.data.find((item) => item.id === created.typeId);
  if (!inactiveOption || inactiveOption.is_active)
    throw new Error("Options edit tidak mempertahankan jenis unit nonaktif.");

  const reactivated = await request(`/api/organization-unit-types/${created.typeId}`, {
    method: "PATCH",
    cookie,
    body: {
      organizationId,
      code: deactivated.payload.data.code,
      name: deactivated.payload.data.name,
      description: deactivated.payload.data.description,
      sortOrder: deactivated.payload.data.sort_order,
      isActive: true,
      version: deactivated.payload.data.updated_at,
    },
  });
  expectStatus(reactivated, 200, "Aktifkan kembali jenis unit");

  const deactivatedAgain = await request(`/api/organization-unit-types/${created.typeId}`, {
    method: "DELETE",
    cookie,
  });
  expectStatus(deactivatedAgain, 200, "Nonaktifkan kembali jenis unit");

  const retained = await request(`/api/organization-units/${created.unitId}`, {
    method: "PATCH",
    cookie,
    body: {
      organizationId,
      parentUnitId: null,
      code: unit.payload.data.code,
      name: `${unit.payload.data.name} Diperbarui`,
      unitTypeId: created.typeId,
      locationIds: [],
      isActive: true,
      version: unit.payload.data.updated_at,
    },
  });
  expectStatus(retained, 200, "Pertahankan jenis nonaktif pada unit lama");

  const listedUnit = await request(
    `/api/organization-units?organizationId=${organizationId}&search=${encodeURIComponent(suffix)}`,
    { cookie },
  );
  expectStatus(listedUnit, 200, "List unit dengan nama jenis dari database");
  if (
    !listedUnit.payload.data.some(
      (item) => item.id === created.unitId && item.unit_type_name === type.payload.data.name,
    )
  )
    throw new Error("List unit tidak memuat nama jenis unit dari database.");

  const inactiveRejected = await request("/api/organization-units", {
    method: "POST",
    cookie,
    body: {
      organizationId,
      parentUnitId: null,
      code: `QA_UNIT_2_${suffix}`,
      name: `Unit QA Baru ${suffix}`,
      unitTypeId: created.typeId,
      locationIds: [],
      isActive: true,
    },
  });
  expectStatus(inactiveRejected, 409, "Tolak jenis nonaktif pada unit baru");

  if (organizations[1]) {
    const crossOrganization = await request("/api/organization-units", {
      method: "POST",
      cookie,
      body: {
        organizationId: organizations[1].id,
        parentUnitId: null,
        code: `QA_CROSS_${suffix}`,
        name: `Unit Lintas Organisasi ${suffix}`,
        unitTypeId: created.typeId,
        locationIds: [],
        isActive: true,
      },
    });
    expectStatus(crossOrganization, 400, "Tolak jenis lintas organisasi");
  }

  if (hrd && organizations.some((item) => item.id !== String(hrd.organization_id))) {
    const otherOrganization = organizations.find(
      (item) => item.id !== String(hrd.organization_id),
    ).id;
    const hrdCookie = await createCookie(hrd);
    const forbidden = await request(
      `/api/organization-unit-types?organizationId=${otherOrganization}`,
      { cookie: hrdCookie },
    );
    expectStatus(forbidden, 403, "Tolak HRD lintas organisasi");
  }

  console.log("HTTP QA Jenis Unit Organisasi berhasil.");
}

run()
  .finally(cleanup)
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
