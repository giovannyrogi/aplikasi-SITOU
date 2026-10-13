import {verifyDirectoryFilters} from "./test-employee-directory-filters-helper.mjs";
import {verifyOpeningRules} from "./test-inventory-openings-helper.mjs";
import assert from "node:assert/strict";
import { verifyHrisAccess } from "./test-hris-access-helper.mjs";
import { randomUUID } from "node:crypto";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import sharp from "sharp";
import { spawn } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";
import os from "node:os";
import dotenv from "dotenv";
import pg from "pg";
import bcrypt from "bcryptjs";
import { createSessionToken } from "../lib/auth/session.js";
import { processNextFilePurgeJob } from "../lib/storage-maintenance/worker.mjs";
dotenv.config({ path: ".env.development", quiet: true });
assert.ok(process.env.PGDATABASE && !/prod/i.test(process.env.PGDATABASE));
const databaseName = "sitou_inventory_test_" + randomUUID().replaceAll("-", "").slice(0, 12);
assert.match(databaseName, /^sitou_inventory_test_[a-f0-9]{12}$/);
const admin = new pg.Client({ database: process.env.PGADMIN_DATABASE || "postgres" });
let db,
  server,
  browser,
  created = false;
let clam;
const base = "http://127.0.0.1:3004";
const password = "Qa_Inventory1!";
const screenshots = await mkdtemp(path.join(os.tmpdir(), "sitou-inventory-ui-"));
const uploadRoot = path.join(screenshots, "uploads");
const req = async (route, cookie, method = "GET", body) => {
  const response = await fetch(base + route, {
    method,
    headers: {
      Origin: base,
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, ...(await response.json()) };
};
const expect = (result, status) => {
  assert.equal(result.status, status, result.message || JSON.stringify(result));
  return result.data;
};
try {
  await admin.connect();
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  created = true;
  db = new pg.Pool({ database: databaseName });
  const schema = await readFile("sitou_schema_v3.sql", "utf8");
  const baseline = schema.split("-- Migration 045: fondasi Inventaris.")[0];
  await db.query(baseline);
  await db.query(await readFile("database/migrations/20261008_045_inventory_access.sql", "utf8"));
  await db.query(
    await readFile("database/migrations/20261008_046_inventory_warehouse_scope_lock.sql", "utf8"),
  );
  await db.query(await readFile("database/migrations/20261009_047_inventory_catalog.sql", "utf8"));
  await db.query(
    await readFile("database/migrations/20261009_048_inventory_photo_category.sql", "utf8"),
  );
  await db.query(
    await readFile("database/migrations/20261009_049_inventory_access_levels.sql", "utf8"),
  );
  await db.query(
    await readFile("database/migrations/20261009_050_inventory_master_access.sql", "utf8"),
  );
  await db.query(await readFile("database/migrations/20261009_051_hris_menu_access.sql", "utf8"));
  await db.query(
    await readFile("database/migrations/20261009_052_hris_account_delegation.sql", "utf8"),
  );
  await db.query(
    await readFile("database/migrations/20261011_054_inventory_transactions.sql", "utf8"),
  );
  await db.query(
    await readFile(
      "database/migrations/20261011_055_inventory_transaction_files_and_immutability.sql",
      "utf8",
    ),
  );
  await db.query(
    await readFile("database/migrations/20261011_056_inventory_transaction_drafts.sql", "utf8"),
  );
  await db.query(await readFile("database/migrations/20261012_057_inventory_opening_revisions.sql", "utf8"));
  assert.equal(
    (await db.query("SELECT count(*)::int count FROM access_packages")).rows[0].count,
    4,
  );
  // Database terpisah kedua membuktikan schema bootstrap lengkap tanpa migration tambahan.
  const bootstrapName = databaseName + "_bootstrap";
  await admin.query(`CREATE DATABASE "${bootstrapName}"`);
  const bootstrap = new pg.Client({ database: bootstrapName });
  try {
    await bootstrap.connect();
    await bootstrap.query(schema);
    assert.equal(
      (await bootstrap.query("SELECT count(*)::int count FROM access_packages")).rows[0].count,
      4,
    );
    const transactionSignature = async (database) =>
      (
        await database.query(
          `SELECT table_name,column_name,data_type,is_nullable
        FROM information_schema.columns WHERE table_schema='public' AND table_name=ANY($1::text[])
        ORDER BY table_name,ordinal_position`,
          [
            [
              "inventory_transactions",
              "inventory_transaction_lines",
              "inventory_stock_openings",
              "inventory_stock_movements",
              "inventory_stock_balances",
              "inventory_transaction_files",
            ],
          ],
        )
      ).rows;
    assert.deepEqual(await transactionSignature(db), await transactionSignature(bootstrap));
  } finally {
    await bootstrap.end();
    await admin.query(`DROP DATABASE "${bootstrapName}"`);
  }
  const organizations = [];
  for (let index = 0; index < 2; index++) {
    const org = (
      await db.query("INSERT INTO organizations(code,name) VALUES($1,$2) RETURNING id::text", [
        "QA_ORG_" + index,
        "Organisasi Inventaris Uji " + index,
      ])
    ).rows[0].id;
    await db.query(
      "INSERT INTO organization_subscriptions(organization_id,starts_on,ends_on,status) VALUES($1,current_date-10,current_date+365,'active')",
      [org],
    );
    const locations = [];
    for (let location = 0; location < 2; location++)
      locations.push(
        (
          await db.query(
            "INSERT INTO locations(organization_id,code,name,operational_from) VALUES($1,$2,$3,current_date-10) RETURNING id::text",
            [org, "QA_" + location, location ? "Cabang Bersehati" : "Kantor Pusat"],
          )
        ).rows[0].id,
      );
    const type = (
      await db.query(
        "INSERT INTO organization_unit_types(organization_id,code,name) VALUES($1,'DIV','Divisi') RETURNING id",
        [org],
      )
    ).rows[0].id;
    const unit = (
      await db.query(
        "INSERT INTO organization_units(organization_id,code,name,unit_type_id) VALUES($1,'UMUM','Divisi Umum',$2) RETURNING id",
        [org, type],
      )
    ).rows[0].id;
    organizations.push({ id: org, locations, unit });
  }
  const [org, other] = organizations;
  const actor = async (role, organization = null, username = role) => {
    const row = (
      await db.query("INSERT INTO users(username,password_hash) VALUES($1,$2) RETURNING id::text", [
        "qa_" + username,
        await bcrypt.hash(password, 12),
      ])
    ).rows[0];
    const membership = (
      await db.query(
        "INSERT INTO user_organization_roles(user_id,organization_id,role_id,location_scope_mode) SELECT $1,$2,id,'all' FROM roles WHERE code=$3 RETURNING id::text",
        [row.id, organization, role],
      )
    ).rows[0].id;
    return {
      ...row,
      membership,
      role_code: role,
      organization_id: organization,
      cookie:
        "sitou_session=" +
        (await createSessionToken({
          userId: row.id,
          roleCode: role,
          organizationId: organization,
          credentialVersion: 1,
          expiresAt: Date.now() + 600000,
        })),
    };
  };
  const superadmin = await actor("superadmin");
  const hrd = await actor("hrd", org.id);
  const reviewedBeforeUpgrade = await actor("hrd", org.id, "reviewed_before_053");
  await db.query(
    "INSERT INTO user_hris_menu_grants(organization_id,membership_id,menu_code,access_level) VALUES($1,$2,'master-positions','read')",
    [org.id, reviewedBeforeUpgrade.membership],
  );
  await db.query(
    "INSERT INTO user_hris_access_settings(organization_id,membership_id) VALUES($1,$2)",
    [org.id, reviewedBeforeUpgrade.membership],
  );
  // Upgrade akun lama: hak efektif dibekukan sebagai grant sebelum fallback dihapus.
  await db.query(
    await readFile("database/migrations/20261010_053_hris_explicit_legacy_access.sql", "utf8"),
  );
  assert.equal(
    (
      await db.query(
        "SELECT count(*)::int total FROM user_hris_menu_grants WHERE organization_id=$1 AND membership_id=$2",
        [org.id, hrd.membership],
      )
    ).rows[0].total,
    14,
  );
  assert.deepEqual(
    (
      await db.query(
        "SELECT can_manage_employee_accounts,can_delegate_employee_features FROM user_hris_access_settings WHERE organization_id=$1 AND membership_id=$2",
        [org.id, hrd.membership],
      )
    ).rows[0],
    { can_manage_employee_accounts: true, can_delegate_employee_features: true },
  );
  assert.equal(
    (
      await db.query(
        "SELECT count(*)::int total FROM user_hris_menu_grants WHERE organization_id=$1 AND membership_id=$2",
        [org.id, reviewedBeforeUpgrade.membership],
      )
    ).rows[0].total,
    1,
  );
  await db.query(
    "DELETE FROM user_hris_access_settings WHERE organization_id=$1 AND membership_id=$2",
    [org.id, reviewedBeforeUpgrade.membership],
  );
  await db.query(
    "DELETE FROM user_hris_menu_grants WHERE organization_id=$1 AND membership_id=$2",
    [org.id, reviewedBeforeUpgrade.membership],
  );
  await db.query("DELETE FROM user_organization_roles WHERE id=$1", [
    reviewedBeforeUpgrade.membership,
  ]);
  await db.query("DELETE FROM users WHERE id=$1", [reviewedBeforeUpgrade.id]);
  const employeeProfile = async (nip) => {
    const id = (
      await db.query(
        "INSERT INTO employees(organization_id,employee_no,full_name,national_id,joined_date,employment_status) VALUES($1,$2,$3,$4,current_date-10,'active') RETURNING id::text",
        [org.id, nip, "Pegawai " + nip, String(Date.now()) + String(nip.length).padStart(3, "0")],
      )
    ).rows[0].id;
    await db.query(
      "INSERT INTO employee_assignments(organization_id,employee_id,location_id,organization_unit_id,effective_from) VALUES($1,$2,$3,$4,current_date-10)",
      [org.id, id, org.locations[1], org.unit],
    );
    return id;
  };
  clam = createServer((socket) => {
    let buffer = Buffer.alloc(0),
      started = false,
      done = false;
    socket.on("data", (chunk) => {
      if (done) return;
      buffer = Buffer.concat([buffer, chunk]);
      if (!started) {
        const end = buffer.indexOf(0);
        if (end < 0) return;
        buffer = buffer.subarray(end + 1);
        started = true;
      }
      while (buffer.length >= 4) {
        const size = buffer.readUInt32BE(0);
        if (size === 0) {
          done = true;
          socket.end("stream: OK\0");
          return;
        }
        if (buffer.length < size + 4) return;
        buffer = buffer.subarray(size + 4);
      }
    });
  });
  await new Promise((resolve) => clam.listen(0, "127.0.0.1", resolve));
  server = spawn(
    process.execPath,
    [
      "-r",
      "dotenv/config",
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3004",
    ],
    {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        PGDATABASE: databaseName,
        NODE_ENV: "production",
        DOTENV_CONFIG_PATH: ".env.development",
        APP_ORIGIN: base,
        UPLOAD_ROOT: uploadRoot,
        CLAMAV_HOST: "127.0.0.1",
        CLAMAV_PORT: String(clam.address().port),
      },
    },
  );
  server.stderr.on("data", (chunk) => process.stderr.write(chunk));
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error("Server uji belum siap")), 20000);
    server.stdout.on("data", (chunk) => {
      if (chunk.toString().includes("Ready")) {
        clearTimeout(timer);
        resolve();
      }
    });
    server.once("exit", () => {
      clearTimeout(timer);
      reject(Error("Server uji gagal mulai"));
    });
  });
  const modules = "/api/access/modules";
  const warehouses = "/api/inventory/warehouses";
  const organizationRows = async () =>
    expect(await req("/api/organizations?status=all", superadmin.cookie), 200);
  assert.deepEqual((await organizationRows()).find((row) => row.id === org.id).active_features, []);
  const initial = expect(await req(`${modules}?organizationId=${org.id}`, superadmin.cookie), 200);
  assert.equal(initial.is_enabled, false);
  expect(
    await req(modules, hrd.cookie, "PATCH", {
      organizationId: org.id,
      isEnabled: true,
      version: 0,
    }),
    403,
  );
  let moduleRecord = expect(
    await req(modules, superadmin.cookie, "PATCH", {
      organizationId: org.id,
      isEnabled: true,
      version: 0,
    }),
    200,
  );
  assert.deepEqual((await organizationRows()).find((row) => row.id === org.id).active_features, [
    { code: "inventory", name: "Fitur Inventaris" },
  ]);
  assert.deepEqual(
    (await organizationRows()).find((row) => row.id === other.id).active_features,
    [],
  );
  expect(
    await req(modules, superadmin.cookie, "PATCH", {
      organizationId: org.id,
      isEnabled: true,
      version: 0,
    }),
    409,
  );
  const warehouseInput = (locationId, code) => ({
    organizationId: org.id,
    locationId,
    code,
    name: "Gudang " + code,
    notes: null,
    isActive: true,
  });
  let pusat = expect(
    await req(warehouses, superadmin.cookie, "POST", warehouseInput(org.locations[0], "PUSAT")),
    201,
  );
  let cabang = expect(
    await req(warehouses, superadmin.cookie, "POST", warehouseInput(org.locations[1], "BERSEHATI")),
    201,
  );
  const duplicate = await req(
    warehouses,
    superadmin.cookie,
    "POST",
    warehouseInput(org.locations[0], "pusat"),
  );
  expect(duplicate, 409);
  assert.ok(duplicate.fieldErrors.code);
  const mutateWarehouse = (row, changes = {}) => ({
    ...warehouseInput(row.location_id, row.code),
    name: row.name,
    version: row.version,
    ...changes,
  });
  const oldCabang = cabang;
  cabang = expect(
    await req(
      warehouses + "/" + cabang.id,
      superadmin.cookie,
      "PATCH",
      mutateWarehouse(cabang, { name: "Gudang Bersehati" }),
    ),
    200,
  );
  expect(
    await req(warehouses + "/" + cabang.id, superadmin.cookie, "PATCH", mutateWarehouse(oldCabang)),
    409,
  );
  const profile = await employeeProfile("UJI_INVENTARIS");
  const noPackageProfile = await employeeProfile("UJI_TANPA_PAKET");
  const input = {
    organizationId: org.id,
    employeeId: profile,
    username: "qa_pegawai_inventory",
    roleCode: "employee",
    isActive: true,
    password,
    confirmPassword: password,
    packageAccess: [
      { packageCode: "inventory_reader", scopeMode: "selected", warehouseIds: [Number(pusat.id)] },
      {
        packageCode: "inventory_manager",
        scopeMode: "selected",
        warehouseIds: [Number(cabang.id)],
      },
    ],
  };
  let account = expect(await req("/api/access/accounts", hrd.cookie, "POST", input), 201);
  assert.equal(account.packageAccess.length, 2);
  const regression = spawn(process.execPath, ["scripts/test-account-linking-http.mjs"], {
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, PGDATABASE: databaseName, SITOU_TEST_BASE_URL: base },
  });
  let regressionOutput = "";
  regression.stdout.on("data", (chunk) => {
    regressionOutput += chunk.toString();
  });
  regression.stderr.on("data", (chunk) => {
    regressionOutput += chunk.toString();
  });
  const regressionExit = await new Promise((resolve) => regression.once("exit", resolve));
  assert.equal(regressionExit, 0, regressionOutput);
  const noPackage = expect(
    await req("/api/access/accounts", hrd.cookie, "POST", {
      ...input,
      employeeId: noPackageProfile,
      username: "qa_pegawai_no_inventory",
      packageAccess: [],
    }),
    201,
  );
  const cookieFor = async (row) =>
    "sitou_session=" +
    (await createSessionToken({
      userId: row.id,
      roleCode: "employee",
      organizationId: org.id,
      credentialVersion: 1,
      expiresAt: Date.now() + 600000,
    }));
  const employeeCookie = await cookieFor(account);
  const emptyCookie = await cookieFor(noPackage);
  expect(await req("/api/auth/login", null, "POST", { username: input.username, password }), 200);
  expect(await req(warehouses + "?organizationId=" + org.id, null), 401);
  expect(await req(warehouses + "?organizationId=" + org.id, emptyCookie), 403);
  const snapshot = expect(await req("/api/access/me", employeeCookie), 200);
  assert.equal(snapshot.inventoryVisible, true);
  assert.equal(snapshot.canCreateWarehouse, false);
  expect(await req("/api/employees?organizationId=" + org.id, employeeCookie), 403);
  const rows = expect(await req(warehouses + "?organizationId=" + org.id, employeeCookie), 200);
  assert.equal(rows.length, 2);
  assert.equal(rows.find((r) => r.id === pusat.id).canEdit, false);
  assert.equal(rows.find((r) => r.id === cabang.id).canEdit, false);
  expect(
    await req(warehouses + "/" + pusat.id, employeeCookie, "PATCH", mutateWarehouse(pusat)),
    403,
  );
  expect(
    await req(warehouses + "/" + cabang.id, employeeCookie, "PATCH", mutateWarehouse(cabang)),
    403,
  );
  cabang = expect(
    await req(
      warehouses + "/" + cabang.id,
      superadmin.cookie,
      "PATCH",
      mutateWarehouse(cabang, { notes: "Keterangan uji" }),
    ),
    200,
  );
  expect(
    await req(warehouses, employeeCookie, "POST", warehouseInput(org.locations[1], "BARU")),
    403,
  );
  const locationChange = await req(
    warehouses + "/" + cabang.id,
    superadmin.cookie,
    "PATCH",
    mutateWarehouse(cabang, { locationId: org.locations[0] }),
  );
  expect(locationChange, 409);
  assert.ok(locationChange.fieldErrors.locationId);
  const updateInput = (row, extra = {}) => ({
    organizationId: org.id,
    employeeId: row.employee_id,
    username: row.username,
    roleCode: row.role_code,
    isActive: true,
    version: row.updated_at,
    ...extra,
  });
  account = expect(
    await req(`/api/access/accounts/${account.id}?organizationId=${org.id}`, hrd.cookie),
    200,
  );
  account = expect(
    await req("/api/access/accounts/" + account.id, hrd.cookie, "PATCH", updateInput(account)),
    200,
  );
  assert.equal(account.packageAccess.length, 2);
  const rollback = await req(
    "/api/access/accounts/" + account.id,
    hrd.cookie,
    "PATCH",
    updateInput(account, {
      username: "qa_changed_should_rollback",
      packageAccess: [
        { packageCode: "inventory_manager", scopeMode: "selected", warehouseIds: [999999] },
      ],
    }),
  );
  expect(rollback, 400);
  assert.ok(rollback.fieldErrors);
  assert.equal(
    (await db.query("SELECT username FROM users WHERE id=$1", [account.id])).rows[0].username,
    input.username,
  );
  expect(
    await req(
      "/api/access/accounts/" + account.id,
      hrd.cookie,
      "PATCH",
      updateInput(account, { version: "2000-01-01T00:00:00Z" }),
    ),
    409,
  );
  await db.query("UPDATE user_organization_roles SET location_scope_mode='selected' WHERE id=$1", [
    hrd.membership,
  ]);
  await db.query(
    "INSERT INTO user_location_scopes(user_organization_role_id,organization_id,location_id) VALUES($1,$2,$3)",
    [hrd.membership, org.id, org.locations[1]],
  );
  const options = expect(
    await req(
      `/api/access/accounts/reference-options?organizationId=${org.id}&accountId=${account.id}`,
      hrd.cookie,
    ),
    200,
  );
  assert.equal(options.canGrantAll, false);
  assert.equal(options.canGrantMaster, false);
  assert.equal(options.packages.find((p) => p.code === "inventory_master").disabled, true);
  assert.deepEqual(options.lockedPackageCodes, ["inventory_reader"]);
  assert.equal(options.warehouses.length, 1);
  expect(
    await req(
      "/api/access/accounts/" + account.id,
      hrd.cookie,
      "PATCH",
      updateInput(account, {
        packageAccess: [{ packageCode: "inventory_manager", scopeMode: "all", warehouseIds: [] }],
      }),
    ),
    403,
  );
  const existingGrants = account.packageAccess.map((g) => ({
    packageCode: g.packageCode,
    scopeMode: g.scopeMode,
    warehouseIds: g.warehouseIds.map(Number),
  }));
  const outsideNew = existingGrants.map((g) =>
    g.packageCode === "inventory_manager" ? { ...g, warehouseIds: [Number(pusat.id)] } : g,
  );
  expect(
    await req(
      "/api/access/accounts/" + account.id,
      hrd.cookie,
      "PATCH",
      updateInput(account, { packageAccess: outsideNew }),
    ),
    400,
  );
  expect(await req(warehouses + "?organizationId=" + other.id, employeeCookie), 403);
  expect(
    await req(warehouses + "/" + cabang.id, employeeCookie, "PATCH", {
      ...mutateWarehouse(cabang),
      organizationId: other.id,
    }),
    403,
  );
  const foreign = (
    await db.query(
      "INSERT INTO inventory_warehouses(organization_id,location_id,code,name) VALUES($1,$2,'FOREIGN','Gudang organisasi lain') RETURNING id",
      [other.id, other.locations[0]],
    )
  ).rows[0].id;
  await assert.rejects(
    db.query(
      "INSERT INTO user_package_warehouse_scopes(organization_id,grant_id,warehouse_id) VALUES($1,$2,$3)",
      [org.id, account.packageAccess[0].id, foreign],
    ),
    { code: "23503" },
  );
  moduleRecord = expect(
    await req(modules, superadmin.cookie, "PATCH", {
      organizationId: org.id,
      isEnabled: false,
      version: moduleRecord.version,
    }),
    200,
  );
  assert.deepEqual((await organizationRows()).find((row) => row.id === org.id).active_features, []);
  expect(await req(warehouses + "?organizationId=" + org.id, employeeCookie), 403);
  assert.equal(expect(await req("/api/access/me", employeeCookie), 200).inventoryVisible, false);
  moduleRecord = expect(
    await req(modules, superadmin.cookie, "PATCH", {
      organizationId: org.id,
      isEnabled: true,
      version: moduleRecord.version,
    }),
    200,
  );
  assert.equal(expect(await req("/api/access/me", employeeCookie), 200).inventoryVisible, true);
  account = expect(
    await req(
      "/api/access/accounts/" + account.id,
      superadmin.cookie,
      "PATCH",
      updateInput(account, { packageAccess: [] }),
    ),
    200,
  );
  assert.equal(expect(await req("/api/access/me", employeeCookie), 200).inventoryVisible, false);
  expect(await req(warehouses + "?organizationId=" + org.id, employeeCookie), 403);
  account = expect(
    await req(
      "/api/access/accounts/" + account.id,
      superadmin.cookie,
      "PATCH",
      updateInput(account, { packageAccess: existingGrants }),
    ),
    200,
  );
  pusat = expect(
    await req(
      warehouses + "/" + pusat.id,
      superadmin.cookie,
      "PATCH",
      mutateWarehouse(pusat, { isActive: false }),
    ),
    200,
  );
  assert.equal(
    expect(await req(warehouses + "?organizationId=" + org.id, employeeCookie), 200).find(
      (r) => r.id === pusat.id,
    ).is_active,
    false,
  );
  const allGrant = [{ packageCode: "inventory_manager", scopeMode: "all", warehouseIds: [] }];
  let allAccount = expect(
    await req(
      "/api/access/accounts/" + noPackage.id,
      superadmin.cookie,
      "PATCH",
      updateInput(noPackage, { packageAccess: allGrant }),
    ),
    200,
  );
  assert.equal(expect(await req("/api/access/me", emptyCookie), 200).canCreateWarehouse, false);
  expect(await req(warehouses, emptyCookie, "POST", warehouseInput(org.locations[1], "BARU")), 403);
  allAccount = expect(
    await req(
      "/api/access/accounts/" + allAccount.id,
      superadmin.cookie,
      "PATCH",
      updateInput(allAccount, { roleCode: "hrd" }),
    ),
    200,
  );
  assert.equal(allAccount.packageAccess.length, 1);
  await db.query("UPDATE users SET is_active=false WHERE id=$1", [allAccount.id]);
  expect(await req("/api/access/me", emptyCookie), 401);
  const explain = await db.query(
    "EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) SELECT warehouse.id FROM inventory_warehouses warehouse WHERE warehouse.organization_id=$1 AND warehouse.id=ANY($2::bigint[])",
    [org.id, [pusat.id, cabang.id]],
  );
  assert.ok(Number.isFinite(explain.rows[0]["QUERY PLAN"][0]["Execution Time"]));
  assert.ok(
    (
      await db.query(
        "SELECT count(*)::int count FROM audit_logs WHERE organization_id=$1 AND action LIKE 'access.%'",
        [org.id],
      )
    ).rows[0].count >= 6,
  );
  const masterProfile = await employeeProfile("UJI_PENGELOLA_MASTER");
  const masterGrant = { packageCode: "inventory_master", scopeMode: "all", warehouseIds: [] };
  const fullHrd = await actor("hrd", org.id, "qa_hrd_full_master");
  await db.query(
    "INSERT INTO user_hris_access_settings(organization_id,membership_id,can_manage_employee_accounts,can_delegate_employee_features) VALUES($1,$2,true,true)",
    [org.id, fullHrd.membership],
  );
  const masterAccount = expect(
    await req("/api/access/accounts", fullHrd.cookie, "POST", {
      ...input,
      employeeId: masterProfile,
      username: "qa_inventory_master",
      packageAccess: [masterGrant],
    }),
    201,
  );
  const masterCookie = await cookieFor(masterAccount);
  const masterAccess = expect(await req("/api/access/me", masterCookie), 200);
  assert.equal(masterAccess.canCreateWarehouse, true);
  assert.equal(masterAccess.permissions.includes("inventory.stock.read"), false);
  assert.equal(masterAccess.permissions.includes("inventory.master.read"), true);
  expect(
    await req(warehouses, masterCookie, "POST", warehouseInput(org.locations[0], "MASTER")),
    201,
  );
  expect(
    await req("/api/access/accounts", hrd.cookie, "POST", {
      ...input,
      employeeId: await employeeProfile("UJI_DELEGASI_MASTER"),
      username: "qa_bad_master_delegate",
      packageAccess: [masterGrant],
    }),
    400,
  );
  let combinedAccount = expect(
    await req("/api/access/accounts", superadmin.cookie, "POST", {
      ...input,
      employeeId: await employeeProfile("UJI_GABUNGAN_AKSES"),
      username: "qa_inventory_combined",
      packageAccess: [
        {
          packageCode: "inventory_reader",
          scopeMode: "selected",
          warehouseIds: [Number(cabang.id)],
        },
        {
          packageCode: "inventory_manager",
          scopeMode: "selected",
          warehouseIds: [Number(cabang.id)],
        },
        masterGrant,
      ],
    }),
    201,
  );
  const combinedCookie = await cookieFor(combinedAccount);
  assert.equal(
    expect(
      await req(`/api/inventory/transactions?organizationId=${org.id}&options=1`, combinedCookie),
      200,
    ).canCreate,
    true,
  );
  assert.equal(combinedAccount.packageAccess.length, 3);
  const combinedGrants = combinedAccount.packageAccess.map((grant) => ({
    packageCode: grant.packageCode,
    scopeMode: grant.scopeMode,
    warehouseIds: grant.warehouseIds.map(Number),
  }));
  combinedAccount = expect(
    await req(
      "/api/access/accounts/" + combinedAccount.id,
      superadmin.cookie,
      "PATCH",
      updateInput(combinedAccount, {
        packageAccess: combinedGrants.filter((grant) => grant.packageCode !== "inventory_master"),
      }),
    ),
    200,
  );
  const afterMasterRevoked = expect(await req("/api/access/me", combinedCookie), 200);
  assert.equal(afterMasterRevoked.permissions.includes("inventory.master.read"), false);
  assert.equal(afterMasterRevoked.permissions.includes("inventory.stock.read"), true);
  const masterRevokedPage = await fetch(base + "/master-data/inventory-items", {
    headers: { Cookie: combinedCookie },
    redirect: "manual",
  });
  assert.match(masterRevokedPage.headers.get("location") || "", /dashboard/);
  combinedAccount = expect(
    await req(
      "/api/access/accounts/" + combinedAccount.id,
      superadmin.cookie,
      "PATCH",
      updateInput(combinedAccount, { packageAccess: combinedGrants }),
    ),
    200,
  );
  expect(await req(warehouses + "?organizationId=" + other.id, masterCookie), 403);
  const masterMembership = (
    await db.query(
      "SELECT id FROM user_organization_roles WHERE organization_id=$1 AND user_id=$2",
      [org.id, masterAccount.id],
    )
  ).rows[0].id;
  await assert.rejects(
    db.query(
      "UPDATE user_access_packages SET scope_mode='selected' WHERE organization_id=$1 AND membership_id=$2 AND package_code='inventory_master'",
      [org.id, masterMembership],
    ),
    (error) => error.code === "23514",
  );

  for (const route of [
    "/inventory/stock",
    "/inventory/transactions",
    "/reports/inventory-distribution",
  ]) {
    const denied = await fetch(base + route, {
      headers: { Cookie: masterCookie },
      redirect: "manual",
    });
    assert.match(denied.headers.get("location") || "", /dashboard/);
  }
  const catalog = "/api/inventory/catalog";
  const categoryInput = {
    organizationId: org.id,
    code: "ATK",
    name: "Alat tulis kantor",
    notes: "Perlengkapan menulis dan administrasi kantor.",
    isActive: true,
  };
  const category = expect(
    await req(catalog + "/categories", superadmin.cookie, "POST", categoryInput),
    201,
  );
  expect(
    await req(catalog + "/categories", employeeCookie, "POST", {
      ...categoryInput,
      code: "SCOPED",
      name: "Perlengkapan gudang",
    }),
    403,
  );
  expect(
    await req(catalog + "/categories", superadmin.cookie, "POST", {
      ...categoryInput,
      code: "atk",
    }),
    409,
  );
  const unitInput = {
    organizationId: org.id,
    code: "RIM",
    name: "Rim",
    notes: null,
    isActive: true,
    allowsFractional: false,
  };
  const unit = expect(await req(catalog + "/units", superadmin.cookie, "POST", unitInput), 201);
  const fractional = expect(
    await req(catalog + "/units", superadmin.cookie, "POST", {
      ...unitInput,
      code: "LITER",
      name: "Liter",
      allowsFractional: true,
    }),
    201,
  );
  const noCodeUnitInput = {
    organizationId: org.id,
    name: "Kotak",
    allowsFractional: false,
    isActive: true,
  };
  const noCodeUnit = expect(
    await req(catalog + "/units", masterCookie, "POST", noCodeUnitInput),
    201,
  );
  const savedUnitCode = (
    await db.query("SELECT code FROM inventory_units WHERE organization_id=$1 AND id=$2", [
      org.id,
      noCodeUnit.id,
    ])
  ).rows[0].code;
  assert.match(savedUnitCode, /^UNIT_[A-F0-9]{32}$/);
  const editedNoCodeUnit = expect(
    await req(catalog + "/units/" + noCodeUnit.id, masterCookie, "PATCH", {
      ...noCodeUnitInput,
      name: "Kotak kecil",
      version: noCodeUnit.version,
    }),
    200,
  );
  assert.equal(editedNoCodeUnit.version, noCodeUnit.version + 1);
  assert.equal(
    (
      await db.query("SELECT code FROM inventory_units WHERE organization_id=$1 AND id=$2", [
        org.id,
        noCodeUnit.id,
      ])
    ).rows[0].code,
    savedUnitCode,
  );
  const duplicateUnit = await req(catalog + "/units", superadmin.cookie, "POST", {
    ...noCodeUnitInput,
    name: "kotak kecil",
  });
  expect(duplicateUnit, 409);
  assert.ok(duplicateUnit.fieldErrors.name);
  assert.equal(duplicateUnit.fieldErrors.code, undefined);
  const itemInput = {
    organizationId: org.id,
    code: "HVS_A4",
    name: "Kertas HVS A4",
    categoryId: Number(category.id),
    unitId: Number(unit.id),
    notes: null,
    isActive: true,
    photoAction: "keep",
  };
  let item = expect(await req(catalog + "/items", superadmin.cookie, "POST", itemInput), 201);
  const foreignCategory = (
    await db.query(
      "INSERT INTO inventory_categories(organization_id,code,name) VALUES($1,'OTHER','Kategori organisasi lain') RETURNING id",
      [other.id],
    )
  ).rows[0].id;
  const foreignAttempt = await req(catalog + "/items", superadmin.cookie, "POST", {
    ...itemInput,
    code: "FORGED",
    categoryId: Number(foreignCategory),
  });
  expect(foreignAttempt, 400);
  assert.ok(foreignAttempt.fieldErrors.categoryId);
  const configInput = {
    organizationId: org.id,
    warehouseId: Number(cabang.id),
    minimumStock: 12,
    isActive: true,
    version: 0,
  };
  expect(
    await req(`${catalog}/items/${item.id}/warehouses`, combinedCookie, "PUT", configInput),
    200,
  );
  const extraWarehouse = expect(
    await req(warehouses, superadmin.cookie, "POST", warehouseInput(org.locations[0], "KEDUA")),
    201,
  );
  expect(
    await req(`${catalog}/items/${item.id}/warehouses`, superadmin.cookie, "PUT", {
      ...configInput,
      warehouseId: Number(extraWarehouse.id),
      minimumStock: 9,
    }),
    200,
  );
  const scopedItem = expect(
    await req(`${catalog}/items?organizationId=${org.id}`, employeeCookie),
    200,
  ).find((row) => row.id === item.id);
  assert.deepEqual(scopedItem.warehouse_limits, [
    {
      warehouse_id: String(cabang.id),
      warehouse_name: "Gudang Bersehati",
      minimum_stock: "12.000",
      is_active: true,
    },
  ]);
  const fullItem = expect(
    await req(`${catalog}/items?organizationId=${org.id}`, superadmin.cookie),
    200,
  ).find((row) => row.id === item.id);
  assert.equal(fullItem.warehouse_limits.length, 2);
  const unregisteredItem = expect(
    await req(catalog + "/items", superadmin.cookie, "POST", {
      ...itemInput,
      code: "HVS_BELUM",
      name: "Kertas belum terdaftar",
    }),
    201,
  );
  const filteredItems = async (cookie, suffix) =>
    expect(await req(`${catalog}/items?organizationId=${org.id}${suffix}`, cookie), 200);
  assert.deepEqual(
    (await filteredItems(superadmin.cookie, `&warehouseId=${cabang.id}`)).map((row) => row.id),
    [item.id],
  );
  assert.deepEqual(
    (await filteredItems(superadmin.cookie, `&locationId=${org.locations[0]}`)).map(
      (row) => row.id,
    ),
    [item.id],
  );
  assert.deepEqual(
    (await filteredItems(superadmin.cookie, "&warehouseId=unregistered")).map((row) => row.id),
    [unregisteredItem.id],
  );
  assert.deepEqual(
    (await filteredItems(superadmin.cookie, "&minimumFrom=10&minimumTo=12")).map((row) => row.id),
    [item.id],
  );
  assert.equal((await filteredItems(superadmin.cookie, "&minimumFrom=13")).length, 0);
  expect(
    await req(
      `${catalog}/items?organizationId=${org.id}&warehouseId=${extraWarehouse.id}`,
      employeeCookie,
    ),
    403,
  );
  expect(
    await req(`${catalog}/items?organizationId=${org.id}&minimumFrom=-1`, superadmin.cookie),
    400,
  );
  expect(
    await req(`${catalog}/items?organizationId=${org.id}&locationId=abc`, superadmin.cookie),
    400,
  );
  expect(
    await req(
      `${catalog}/items?organizationId=${org.id}&minimumFrom=13&minimumTo=10`,
      superadmin.cookie,
    ),
    400,
  );
  expect(
    await req(`${catalog}/items/${item.id}/warehouses`, employeeCookie, "PUT", configInput),
    409,
  );
  expect(
    await req(`${catalog}/items/${item.id}/warehouses`, combinedCookie, "PUT", {
      ...configInput,
      warehouseId: Number(pusat.id),
    }),
    403,
  );
  const fractionError = await req(`${catalog}/items/${item.id}/warehouses`, employeeCookie, "PUT", {
    ...configInput,
    minimumStock: 1.5,
    version: 1,
  });
  expect(fractionError, 400);
  assert.ok(fractionError.fieldErrors.minimumStock);
  expect(
    await req(`${catalog}/items/${item.id}`, superadmin.cookie, "PATCH", {
      ...itemInput,
      version: item.version,
      unitId: Number(fractional.id),
    }),
    409,
  );
  expect(
    await req(`${catalog}/units/${unit.id}`, superadmin.cookie, "PATCH", {
      ...unitInput,
      version: unit.version,
      allowsFractional: true,
    }),
    409,
  );
  const multipartPhoto = async (payload, bytes, create = false) => {
    const form = new FormData();
    form.append("payload", JSON.stringify(payload));
    form.append("file", new Blob([bytes], { type: "image/png" }), "barang.png");
    const response = await fetch(
      base + (create ? `${catalog}/items` : `${catalog}/items/${item.id}`),
      {
        method: create ? "POST" : "PATCH",
        headers: { Cookie: superadmin.cookie, Origin: base },
        body: form,
      },
    );
    return { status: response.status, ...(await response.json()) };
  };
  const image = await sharp({
    create: { width: 32, height: 32, channels: 3, background: "#d02030" },
  })
    .png()
    .toBuffer();
  item = expect(await multipartPhoto({ ...itemInput, version: item.version }, image), 200);
  const getItem = async () =>
    expect(await req(catalog + "/items?organizationId=" + org.id, superadmin.cookie), 200).find(
      (row) => row.id === item.id,
    );
  let itemRow = await getItem();
  const originalPhoto = itemRow.photo_file_id;
  assert.ok(originalPhoto);
  const photoResponse = await fetch(
    `${base}/api/uploads/${originalPhoto}?organizationId=${org.id}`,
    { headers: { Cookie: employeeCookie } },
  );
  assert.equal(photoResponse.status, 200);
  assert.equal(photoResponse.headers.get("cache-control"), "private, no-store");
  assert.equal(
    (
      await fetch(`${base}/api/uploads/${originalPhoto}?organizationId=${other.id}`, {
        headers: { Cookie: employeeCookie },
      })
    ).status,
    403,
  );
  const countPhotos = (
    await db.query(
      "SELECT count(*)::int count FROM stored_files WHERE organization_id=$1 AND category='inventory_item_photo'",
      [org.id],
    )
  ).rows[0].count;
  const scannerPort = clam.address().port;
  await new Promise((resolve) => clam.close(resolve));
  try {
    const offlineUpdate = await multipartPhoto({ ...itemInput, version: item.version }, image);
    expect(offlineUpdate, 503);
    assert.equal(offlineUpdate.code, "MALWARE_SCANNER_UNAVAILABLE");
    expect(
      await multipartPhoto(
        { ...itemInput, code: "SCAN_FAILED_CREATE", name: "Barang uji pemindai" },
        image,
        true,
      ),
      503,
    );
    assert.equal(
      (
        await db.query(
          "SELECT count(*)::int count FROM inventory_items WHERE organization_id=$1 AND code='SCAN_FAILED_CREATE'",
          [org.id],
        )
      ).rows[0].count,
      0,
    );
    assert.equal((await getItem()).photo_file_id, originalPhoto);
    assert.equal((await getItem()).version, item.version);
    assert.equal(
      (
        await db.query(
          "SELECT count(*)::int count FROM stored_files WHERE organization_id=$1 AND category='inventory_item_photo'",
          [org.id],
        )
      ).rows[0].count,
      countPhotos,
    );
  } finally {
    await new Promise((resolve) => clam.listen(scannerPort, "127.0.0.1", resolve));
  }
  expect(await multipartPhoto({ ...itemInput, version: 1 }, image), 409);
  assert.equal(
    (
      await db.query(
        "SELECT count(*)::int count FROM stored_files WHERE organization_id=$1 AND category='inventory_item_photo'",
        [org.id],
      )
    ).rows[0].count,
    countPhotos,
  );
  item = expect(await multipartPhoto({ ...itemInput, version: item.version }, image), 200);
  itemRow = await getItem();
  assert.notEqual(itemRow.photo_file_id, originalPhoto);
  assert.equal(
    (await db.query("SELECT lifecycle_status FROM stored_files WHERE id=$1", [originalPhoto]))
      .rows[0].lifecycle_status,
    "deleted",
  );
  assert.equal(
    (
      await db.query("SELECT count(*)::int count FROM file_purge_jobs WHERE stored_file_id=$1", [
        originalPhoto,
      ])
    ).rows[0].count,
    1,
  );
  expect(
    await req(`${catalog}/items/${item.id}`, superadmin.cookie, "PATCH", {
      ...itemInput,
      version: item.version,
      photoAction: "remove",
    }),
    200,
  );
  assert.equal((await getItem()).photo_file_id, null);
  assert.equal(await processNextFilePurgeJob(db, uploadRoot), true);
  assert.equal(await processNextFilePurgeJob(db, uploadRoot), true);
  assert.equal(
    (await db.query("SELECT lifecycle_status FROM stored_files WHERE id=$1", [originalPhoto]))
      .rows[0].lifecycle_status,
    "purged",
  );
  const navigationProfile = await employeeProfile("UJI_MENU_TANPA_AKSES");
  const navigationAccount = expect(
    await req("/api/access/accounts", superadmin.cookie, "POST", {
      ...input,
      employeeId: navigationProfile,
      username: "qa_no_access_navigation",
      packageAccess: [],
    }),
    201,
  );
  const navigationCookie = await cookieFor(navigationAccount);
  const readerProfile = await employeeProfile("UJI_INVENTARIS_LIHAT_SAJA");
  const readerAccount = expect(
    await req("/api/access/accounts", superadmin.cookie, "POST", {
      ...input,
      employeeId: readerProfile,
      username: "qa_inventory_view_only",
      packageAccess: [
        {
          packageCode: "inventory_reader",
          scopeMode: "selected",
          warehouseIds: [Number(cabang.id)],
        },
      ],
    }),
    201,
  );
  const readerCookie = await cookieFor(readerAccount);
  const readerAccess = expect(await req("/api/access/me", readerCookie), 200);
  assert.equal(readerAccess.permissions.includes("inventory.master.read"), false);
  assert.equal(readerAccess.permissions.includes("inventory.reports.read"), true);
  expect(
    await req(catalog + "/categories", readerCookie, "POST", {
      ...categoryInput,
      code: "READONLY",
      name: "Ditolak",
    }),
    403,
  );
  expect(
    await req(warehouses + "/" + pusat.id, readerCookie, "PATCH", mutateWarehouse(pusat)),
    403,
  );
  for (const route of [
    "/inventory/stock",
    "/inventory/transactions",
    "/reports/inventory-distribution",
  ]) {
    const response = await fetch(base + route, {
      headers: { Cookie: readerCookie },
      redirect: "manual",
    });
    assert.equal(response.status, 200);
  }
  for (const route of [
    "/master-data/inventory-items",
    "/master-data/inventory-categories",
    "/master-data/inventory-units",
    "/master-data/inventory-warehouses",
  ]) {
    const response = await fetch(base + route, {
      headers: { Cookie: readerCookie },
      redirect: "manual",
    });
    assert.match(response.headers.get("location") || "", /dashboard/);
  }
  for (const route of [
    "/master-data/inventory-items",
    "/master-data/inventory-categories",
    "/master-data/inventory-units",
    "/master-data/inventory-warehouses",
    "/reports/inventory-distribution",
  ]) {
    const allowed = await fetch(base + route, {
      headers: { Cookie: route.startsWith("/master-data") ? combinedCookie : employeeCookie },
      redirect: "manual",
    });
    assert.equal(allowed.status, 200, route);
    for (const cookie of [navigationCookie, hrd.cookie]) {
      const denied = await fetch(base + route, { headers: { Cookie: cookie }, redirect: "manual" });
      assert.match(denied.headers.get("location") || "", /dashboard/, route);
    }
  }
  for (const route of ["/master-data/positions", "/reports/expiring-contracts"]) {
    const denied = await fetch(base + route, {
      headers: { Cookie: employeeCookie },
      redirect: "manual",
    });
    assert.match(denied.headers.get("location") || "", /dashboard/);
  }
  const legacy = await fetch(base + "/inventory/master-data?organizationId=" + org.id, {
    headers: { Cookie: superadmin.cookie },
    redirect: "manual",
  });
  assert.ok(legacy.status >= 300 && legacy.status < 400);
  assert.match(legacy.headers.get("location"), /master-data\/inventory-items/);
  const transactions = "/api/inventory/transactions";
  const transactionItem = expect(
    await req(catalog + "/items", superadmin.cookie, "POST", {
      ...itemInput,
      code: "PENA_UJI",
      name: "Pena transaksi uji",
    }),
    201,
  );
  expect(
    await req(`${catalog}/items/${transactionItem.id}/warehouses`, superadmin.cookie, "PUT", {
      ...configInput,
      minimumStock: 2,
    }),
    200,
  );
  const today = (
    await db.query(
      "SELECT to_char((now() AT TIME ZONE timezone)::date,'YYYY-MM-DD') AS value FROM organizations WHERE id=$1",
      [org.id],
    )
  ).rows[0].value;
  const daysAgo = (days) =>
    new Date(Date.parse(today + "T00:00:00Z") - days * 86400000).toISOString().slice(0, 10);
  const transactionInput = (kind, lines, changes = {}) => ({
    organizationId: Number(org.id),
    transactionId: randomUUID(),
    warehouseId: Number(cabang.id),
    kind,
    occurredOn: today,
    referenceNo: null,
    notes: null,
    lateReason: null,
    destinationLocationId: null,
    destinationUnitId: null,
    recipientEmployeeId: null,
    sourceTransactionId: null,
    lines,
    ...changes,
  });
  const firstLine = [{ itemId: Number(item.id), quantity: 10 }];
  expect(
    await req(transactions, readerCookie, "POST", transactionInput("opening", firstLine)),
    403,
  );
  expect(
    await req(transactions, masterCookie, "POST", transactionInput("opening", firstLine)),
    403,
  );
  expect(
    await req(
      transactions,
      employeeCookie,
      "POST",
      transactionInput("opening", firstLine, { warehouseId: Number(extraWarehouse.id) }),
    ),
    403,
  );
  expect(
    await req(
      transactions,
      employeeCookie,
      "POST",
      transactionInput("opening", firstLine, { organizationId: Number(other.id) }),
    ),
    403,
  );
  const opening = transactionInput(
    "opening",
    [
      { itemId: Number(item.id), quantity: 10 },
      { itemId: Number(transactionItem.id), quantity: 0 },
    ],
    { occurredOn: daysAgo(2), lateReason: "Barang sudah dihitung dua hari lalu." },
  );
  expect(await req(transactions, employeeCookie, "POST", opening), 201);
  assert.equal(
    (
      await db.query(
        "SELECT quantity::text FROM inventory_stock_balances WHERE organization_id=$1 AND warehouse_id=$2 AND item_id=$3",
        [org.id, cabang.id, transactionItem.id],
      )
    ).rows[0].quantity,
    "0.000",
  );
  expect(await req(transactions, employeeCookie, "POST", opening), 201);
  expect(
    await req(transactions, employeeCookie, "POST", transactionInput("opening", firstLine)),
    409,
  );
  const draft = transactionInput("receipt", [{ itemId: Number(item.id), quantity: 2 }]);
  const savedDraft = expect(
    await req(`${transactions}/drafts`, employeeCookie, "POST", { ...draft, version: undefined }),
    200,
  );
  assert.equal(
    (
      await db.query(
        "SELECT quantity::text FROM inventory_stock_balances WHERE organization_id=$1 AND warehouse_id=$2 AND item_id=$3",
        [org.id, cabang.id, item.id],
      )
    ).rows[0].quantity,
    "10.000",
  );
  expect(
    await req(`${transactions}/drafts`, employeeCookie, "POST", {
      ...draft,
      version: savedDraft.version,
    }),
    200,
  );
  expect(
    await req(transactions, employeeCookie, "POST", { ...draft, version: savedDraft.version }),
    409,
  );
  const currentDraft = (
    await db.query("SELECT version FROM inventory_transactions WHERE id=$1", [draft.transactionId])
  ).rows[0];
  expect(
    await req(transactions, employeeCookie, "POST", { ...draft, version: currentDraft.version }),
    201,
  );
  await db.query(
    "INSERT INTO organization_unit_locations(organization_id,organization_unit_id,location_id,active_from) VALUES($1,$2,$3,current_date-10)",
    [org.id, org.unit, org.locations[1]],
  );
  const receipt = transactionInput("receipt", [
    { itemId: Number(transactionItem.id), quantity: 5 },
  ]);
  expect(await req(transactions, employeeCookie, "POST", receipt), 201);
  const staged = transactionInput("receipt", [{ itemId: Number(transactionItem.id), quantity: 1 }]);
  const stagedSaved = expect(
    await req(`${transactions}/drafts`, employeeCookie, "POST", { ...staged, currentStep: 1 }),
    200,
  );
  assert.equal(
    expect(
      await req(`${transactions}/${staged.transactionId}?organizationId=${org.id}`, employeeCookie),
      200,
    ).draft_step,
    1,
  );
  const stagedForm = new FormData();
  stagedForm.append("organizationId", org.id);
  stagedForm.append("purpose", "purchase_proof");
  const rejectedProof = new FormData();
  rejectedProof.append("organizationId", org.id);
  rejectedProof.append("purpose", "purchase_proof");
  rejectedProof.append(
    "file",
    new Blob([Buffer.from("%PDF-1.4\n%%EOF")], { type: "application/pdf" }),
    "bukti-lama.pdf",
  );
  const rejectedResponse = await fetch(
    `${base}${transactions}/${staged.transactionId}/draft-files`,
    { method: "POST", headers: { Origin: base, Cookie: employeeCookie }, body: rejectedProof },
  );
  assert.ok(rejectedResponse.status >= 400);
  stagedForm.append("file", new Blob([image], { type: "image/png" }), "bukti-draft.png");
  const stagedResponse = await fetch(`${base}${transactions}/${staged.transactionId}/draft-files`, {
    method: "POST",
    headers: { Origin: base, Cookie: employeeCookie },
    body: stagedForm,
  });
  const stagedFile = expect(
    { status: stagedResponse.status, ...(await stagedResponse.json()) },
    201,
  );
  assert.equal(stagedFile.mimeType, "image/png");
  assert.equal(Number(stagedFile.sizeBytes), image.length);
  assert.equal(
    (
      await fetch(`${base}/api/uploads/${stagedFile.id}?organizationId=${org.id}`, {
        headers: { Cookie: employeeCookie },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await fetch(`${base}/api/uploads/${stagedFile.id}?organizationId=${org.id}`, {
        headers: { Cookie: readerCookie },
      })
    ).status,
    403,
  );
  const stagedDetail = expect(
    await req(`${transactions}/${staged.transactionId}?organizationId=${org.id}`, employeeCookie),
    200,
  );
  assert.equal(stagedDetail.files[0].id, stagedFile.id);
  assert.equal(stagedDetail.files[0].mimeType, stagedFile.mimeType);
  assert.equal(Number(stagedDetail.files[0].sizeBytes), image.length);
  expect(
    await req(transactions, employeeCookie, "POST", { ...staged, version: stagedSaved.version }),
    201,
  );
  assert.equal(
    (await db.query("SELECT lifecycle_status FROM stored_files WHERE id=$1", [stagedFile.id]))
      .rows[0].lifecycle_status,
    "active",
  );
  const disposable = transactionInput("receipt", [
    { itemId: Number(transactionItem.id), quantity: 1 },
  ]);
  expect(
    await req(`${transactions}/drafts`, employeeCookie, "POST", { ...disposable, currentStep: 1 }),
    200,
  );
  expect(
    await req(
      `${transactions}/${disposable.transactionId}/draft?organizationId=${org.id}`,
      employeeCookie,
      "DELETE",
    ),
    200,
  );
  expect(
    await req(
      `${transactions}/${disposable.transactionId}?organizationId=${org.id}`,
      employeeCookie,
    ),
    404,
  );
  const additionalDraft = transactionInput("receipt", [
    { itemId: Number(transactionItem.id), quantity: 2 },
  ]);
  expect(
    await req(`${transactions}/drafts`, employeeCookie, "POST", {
      ...additionalDraft,
      currentStep: 2,
    }),
    200,
  );
  const parallelDraft = transactionInput("issue", [
    { itemId: Number(transactionItem.id), quantity: 1 },
  ]);
  expect(
    await req(`${transactions}/drafts`, employeeCookie, "POST", {
      ...parallelDraft,
      currentStep: 0,
    }),
    200,
  );
  const latestDraft = expect(
    await req(`${transactions}/drafts?organizationId=${org.id}`, employeeCookie),
    200,
  );
  assert.equal(latestDraft.id, parallelDraft.transactionId);
  expect(
    await req(
      `${transactions}/${parallelDraft.transactionId}/draft?organizationId=${org.id}`,
      employeeCookie,
      "DELETE",
    ),
    200,
  );
  assert.equal(
    expect(await req(`${transactions}/drafts?organizationId=${org.id}`, employeeCookie), 200).id,
    additionalDraft.transactionId,
  );
  const ledger = expect(
    await req(`${transactions}?organizationId=${org.id}&status=all`, employeeCookie),
    200,
  );
  assert.ok(ledger.data.every((entry) => entry.status === "posted"));
  assert.ok(!ledger.data.some((entry) => entry.id === additionalDraft.transactionId));
  assert.ok(new Date(ledger.data[0].sort_at) >= new Date(ledger.data.at(-1).sort_at));
  const proofTransaction = transactionInput(
    "receipt",
    [{ itemId: Number(transactionItem.id), quantity: 1 }],
    { referenceNo: "QA-BUKTI-GAMBAR-001" },
  );
  const proofForm = new FormData();
  proofForm.append("payload", JSON.stringify(proofTransaction));
  proofForm.append("purchaseProof", new Blob([image], { type: "image/png" }), "bukti-uji.png");
  const proofResponse = await fetch(base + transactions, {
    method: "POST",
    headers: { Origin: base, Cookie: employeeCookie },
    body: proofForm,
  });
  const proofBody = { status: proofResponse.status, ...(await proofResponse.json()) };
  const proofPosted = expect(proofBody, 201);
  assert.equal(proofPosted.files.length, 1);
  const fileUrl = `/api/uploads/${proofPosted.files[0].id}?organizationId=${org.id}&download=1`;
  assert.equal((await fetch(base + fileUrl, { headers: { Cookie: employeeCookie } })).status, 200);
  assert.equal((await fetch(base + fileUrl, { headers: { Cookie: readerCookie } })).status, 200);
  assert.equal((await fetch(base + fileUrl, { headers: { Cookie: masterCookie } })).status, 403);
  await assert.rejects(
    db.query("UPDATE inventory_transactions SET notes='diubah' WHERE id=$1", [
      proofTransaction.transactionId,
    ]),
  );
  const issue = transactionInput("issue", [{ itemId: Number(item.id), quantity: 3 }], {
    destinationLocationId: Number(org.locations[1]),
    destinationUnitId: Number(org.unit),
    recipientEmployeeId: Number(profile),
  });
  expect(await req(transactions, employeeCookie, "POST", issue), 201);
  const excessiveReturn = transactionInput("return", [{ itemId: Number(item.id), quantity: 4 }], {
    sourceTransactionId: issue.transactionId,
  });
  expect(await req(transactions, employeeCookie, "POST", excessiveReturn), 409);
  const returned = transactionInput("return", [{ itemId: Number(item.id), quantity: 1 }], {
    sourceTransactionId: issue.transactionId,
  });
  expect(await req(transactions, employeeCookie, "POST", returned), 201);
  const stocktake = transactionInput("stocktake", [{ itemId: Number(item.id), quantity: 9 }]);
  expect(await req(transactions, employeeCookie, "POST", stocktake), 201);
  expect(
    await req(`${transactions}/${stocktake.transactionId}/cancel`, employeeCookie, "POST", {
      organizationId: Number(org.id),
      reason: "Hasil hitung fisik sebelumnya keliru.",
      reversalId: randomUUID(),
    }),
    200,
  );
  const cancelledLedger=expect(await req(`${transactions}?organizationId=${org.id}&status=cancelled&pageSize=50`,employeeCookie),200);
  assert.ok(cancelledLedger.data.some((row)=>row.id===stocktake.transactionId && row.cancelled));
  assert.ok(cancelledLedger.data.every((row)=>row.kind!=="reversal"),"Dokumen pembalik tidak tampil sebagai baris ledger kedua");
  const cancelledDetail=expect(await req(`${transactions}/${stocktake.transactionId}?organizationId=${org.id}`,employeeCookie),200);
  assert.equal(cancelledDetail.cancellation_reason,"Hasil hitung fisik sebelumnya keliru.");
  assert.ok(cancelledDetail.cancelled_by_name && cancelledDetail.cancelled_at);
  assert.equal((await req(`${transactions}?organizationId=${org.id}&kind=reversal`,employeeCookie)).status,400);
  const historical = transactionInput("issue", [{ itemId: Number(item.id), quantity: 10 }], {
    occurredOn: daysAgo(1),
    lateReason: "Penyaluran kemarin baru diserahkan ke petugas.",
    destinationLocationId: Number(org.locations[1]),
    destinationUnitId: Number(org.unit),
    recipientEmployeeId: Number(profile),
  });
  expect(await req(transactions, employeeCookie, "POST", historical), 409);
  const concurrent = (quantity) =>
    transactionInput("issue", [{ itemId: Number(item.id), quantity }], {
      destinationLocationId: Number(org.locations[1]),
      destinationUnitId: Number(org.unit),
      recipientEmployeeId: Number(profile),
    });
  const concurrentResults = await Promise.all([
    req(transactions, employeeCookie, "POST", concurrent(7)),
    req(transactions, employeeCookie, "POST", concurrent(7)),
  ]);
  assert.deepEqual(concurrentResults.map((result) => result.status).sort(), [201, 409]);
  assert.equal(
    (
      await db.query(
        "SELECT quantity::text FROM inventory_stock_balances WHERE organization_id=$1 AND warehouse_id=$2 AND item_id=$3",
        [org.id, cabang.id, item.id],
      )
    ).rows[0].quantity,
    "3.000",
  );
  assert.ok(
    expect(
      await req(`${transactions}/${issue.transactionId}?organizationId=${org.id}`, readerCookie),
      200,
    ).lines.length,
  );
  expect(
    await req(`${transactions}/${issue.transactionId}?organizationId=${other.id}`, readerCookie),
    403,
  );
  const ledgerPage = expect(
    await req(`${transactions}?organizationId=${org.id}&pageSize=10`, readerCookie),
    200,
  );
  assert.ok(ledgerPage.total >= ledgerPage.data.length);
  assert.ok(ledgerPage.data.length <= 10);
  if (ledgerPage.nextCursor) {
    const nextPage = expect(
      await req(
        `${transactions}?organizationId=${org.id}&pageSize=10&cursor=${encodeURIComponent(ledgerPage.nextCursor)}`,
        readerCookie,
      ),
      200,
    );
    assert.equal(nextPage.total, ledgerPage.total);
    assert.ok(nextPage.data.every((row) => !ledgerPage.data.some((first) => first.id === row.id)));
  }
  expect(await req(`${transactions}?organizationId=${org.id}&pageSize=11`, readerCookie), 400);
  const stockUrl = `/api/inventory/stock?organizationId=${org.id}`;
  const stockList = expect(await req(stockUrl,employeeCookie),200);
  const stockRow = stockList.data.find((row)=>row.item_id===item.id && row.warehouse_id===cabang.id);
  assert.equal(stockRow.quantity,"3.000");
  const returnOptionsUrl=`${transactions}/${issue.transactionId}/return-options?organizationId=${org.id}&warehouseId=${cabang.id}`;
  const returnOptions=expect(await req(returnOptionsUrl,employeeCookie),200);
  assert.equal(returnOptions.lines[0].quantity,"3.000");
  assert.equal(returnOptions.lines[0].returnedQuantity,"1.000");
  assert.equal(returnOptions.lines[0].remainingQuantity,"2.000");
  assert.equal(returnOptions.today,today);
  const recipientName=(await db.query("SELECT full_name FROM employees WHERE organization_id=$1 AND id=$2",[org.id,profile])).rows[0].full_name;
  assert.equal(returnOptions.recipient_name,recipientName);
  assert.ok(returnOptions.destination_location_name);
  assert.ok(returnOptions.destination_unit_name);
  expect(await req(returnOptionsUrl,readerCookie),403);
  expect(await req(returnOptionsUrl,masterCookie),403);
  expect(await req(`${transactions}/${issue.transactionId}/return-options?organizationId=${other.id}&warehouseId=${cabang.id}`,employeeCookie),403);
  expect(await req(`${transactions}/${issue.transactionId}/return-options?organizationId=${org.id}&warehouseId=${extraWarehouse.id}`,employeeCookie),403);
  const parallelReturns=[transactionInput("return",[{itemId:Number(item.id),quantity:2}],{sourceTransactionId:issue.transactionId}),transactionInput("return",[{itemId:Number(item.id),quantity:2}],{sourceTransactionId:issue.transactionId})];
  const parallelReturnResults=await Promise.all(parallelReturns.map((input)=>req(transactions,employeeCookie,"POST",input)));
  assert.deepEqual(parallelReturnResults.map((result)=>result.status).sort(),[201,409],"Pengembalian serentak tidak boleh melebihi jumlah asal");
  assert.equal(expect(await req(returnOptionsUrl,employeeCookie),200).lines[0].remainingQuantity,"0.000");
  const winnerReturn=parallelReturns[parallelReturnResults.findIndex((result)=>result.status===201)];
  expect(await req(`${transactions}/${winnerReturn.transactionId}/cancel`,employeeCookie,"POST",{organizationId:Number(org.id),reason:"Pengembalian uji dibatalkan untuk memulihkan fixture.",reversalId:randomUUID()}),200);
  assert.equal(expect(await req(returnOptionsUrl,employeeCookie),200).lines[0].remainingQuantity,"2.000");
  const previewUrl=`${transactions}/preview`;
  const previewReceipt=transactionInput("receipt",[{itemId:Number(item.id),quantity:1}],{occurredOn:daysAgo(1),lateReason:"Bukti penerimaan baru diserahkan hari ini."});
  const movementCountBefore=(await db.query("SELECT count(*)::int AS count FROM inventory_stock_movements")).rows[0].count;
  const txCountBefore=(await db.query("SELECT count(*)::int AS count FROM inventory_transactions")).rows[0].count;
  const projectedReceipt=expect(await req(previewUrl,employeeCookie,"POST",previewReceipt),200).lines[0];
  assert.equal(projectedReceipt.beforeDate,"10.000");
  assert.equal(projectedReceipt.afterDate,"11.000");
  assert.equal(projectedReceipt.currentBefore,"3.000");
  assert.equal(projectedReceipt.currentAfter,"4.000");
  const projectedCount=expect(await req(previewUrl,employeeCookie,"POST",transactionInput("stocktake",[{itemId:Number(item.id),quantity:12}],{occurredOn:daysAgo(1),lateReason:"Hasil hitung fisik baru diterima hari ini."})),200).lines[0];
  assert.equal(projectedCount.afterDate,"12.000");
  assert.equal(projectedCount.currentAfter,"5.000");
  expect(await req(previewUrl,readerCookie,"POST",previewReceipt),403);
  expect(await req(previewUrl,masterCookie,"POST",previewReceipt),403);
  expect(await req(previewUrl,employeeCookie,"POST",{...previewReceipt,organizationId:Number(other.id)}),403);
  expect(await req(previewUrl,employeeCookie,"POST",{...previewReceipt,warehouseId:Number(extraWarehouse.id)}),403);
  const unsafePreview=await req(previewUrl,employeeCookie,"POST",transactionInput("issue",[{itemId:Number(item.id),quantity:4}],{occurredOn:daysAgo(1),lateReason:"Dokumen penyaluran baru diterima hari ini.",destinationLocationId:Number(org.locations[1]),destinationUnitId:Number(org.unit),recipientEmployeeId:Number(profile)}));
  expect(unsafePreview,409);
  assert.equal(unsafePreview.code,"HISTORICAL_STOCK_NEGATIVE");
  assert.ok(unsafePreview.fieldErrors.lines);
  assert.equal((await db.query("SELECT count(*)::int AS count FROM inventory_stock_movements")).rows[0].count,movementCountBefore);
  assert.equal((await db.query("SELECT count(*)::int AS count FROM inventory_transactions")).rows[0].count,txCountBefore);
  assert.equal(expect(await req(stockUrl,employeeCookie),200).data.find((row)=>row.item_id===item.id).quantity,"3.000");
  assert.equal(stockRow.has_opening,true);
  assert.equal(stockRow.canManageMinimum,true);
  const readOnlyStock = expect(await req(stockUrl,readerCookie),200);
  assert.ok(readOnlyStock.data.every((row)=>!row.canManageMinimum));
  assert.equal(readOnlyStock.canCreate,false);
  expect(await req(stockUrl,masterCookie),403);
  expect(await req(`/api/inventory/stock?organizationId=${other.id}`,readerCookie),403);
  const stockValidation = await req(`${stockUrl}&pageSize=11`,readerCookie);
  expect(stockValidation,400);
  assert.ok(stockValidation.fieldErrors.pageSize);
  const openingFixtures=await verifyOpeningRules({db,req,expect,org,other,superadmin,employeeCookie,readerCookie,masterCookie,itemInput,configInput,catalog,transactions,transactionInput,daysAgo,today,cabang,screenshots,account,updateInput,fullHrd,pusat,profile});
  const historyUrl = `${stockUrl}&action=history&warehouseId=${cabang.id}&itemId=${item.id}`;
  const history = expect(await req(historyUrl,employeeCookie),200);
  assert.equal(history.closing_balance,"3.000");
  let running=0;
  for(const row of history.rows){running+=Number(row.delta);assert.equal(Number(row.balance),running);}
  assert.ok(history.rows.some((row)=>row.kind==="reversal"));
  expect(await req(`${historyUrl}&from=2026-10-12&to=2026-10-01`,employeeCookie),400);
  await db.query(
    `INSERT INTO inventory_items(organization_id,code,name,category_id,unit_id)
    SELECT $1,'BENCH_'||value,'ZZ Katalog uji '||lpad(value::text,3,'0'),$2,$3 FROM generate_series(1,85) value`,
    [org.id, category.id, unit.id],
  );
  await db.query(`INSERT INTO inventory_item_warehouses(organization_id,item_id,warehouse_id,minimum_stock)
    SELECT organization_id,id,$2,2 FROM inventory_items WHERE organization_id=$1 AND code LIKE 'BENCH_%'`,[org.id,cabang.id]);
  const unrecorded = expect(await req(`${stockUrl}&condition=unrecorded&pageSize=10`,employeeCookie),200);
  assert.ok(unrecorded.total>=85);
  assert.ok(unrecorded.data.every((row)=>row.quantity===null && !row.has_opening));
  assert.ok(unrecorded.nextCursor);
  const nextStock = expect(await req(`${stockUrl}&condition=unrecorded&pageSize=10&cursor=${unrecorded.nextCursor}`,employeeCookie),200);
  assert.equal(nextStock.total,unrecorded.total);
  assert.ok(nextStock.data.every((row)=>!unrecorded.data.some((first)=>first.id===row.id)));
  expect(await req(`${stockUrl}&condition=empty&pageSize=10&cursor=${unrecorded.nextCursor}`,employeeCookie),400);
  const repositorySource = (await readFile("lib/inventory/stockRepository.js","utf8")).replace('import pool from "@/lib/dbConfig";',"const pool=null;");
  const stockRepository = await import(`data:text/javascript;base64,${Buffer.from(repositorySource).toString("base64")}`);
  const planDatabase = {query:(text,values)=>db.query(`EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) ${text}`,values)};
  const stockPlan = await stockRepository.readStockRows({organizationId:org.id,search:"",condition:"all",status:"active",pageSize:20},null,null,planDatabase);
  assert.ok(Number.isFinite(stockPlan["QUERY PLAN"][0]["Execution Time"]));
  const historyPlan = await stockRepository.readStockHistory({organizationId:org.id,warehouseId:cabang.id,itemId:item.id,pageSize:20},null,planDatabase);
  assert.ok(Number.isFinite(historyPlan["QUERY PLAN"][0]["Execution Time"]));
  const catalogPlan = await db.query(
    `EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) SELECT item.id,item.name,
    category.name,unit.name FROM inventory_items item JOIN inventory_categories category ON category.organization_id=item.organization_id AND category.id=item.category_id
    JOIN inventory_units unit ON unit.organization_id=item.organization_id AND unit.id=item.unit_id
    WHERE item.organization_id=$1 AND item.is_active ORDER BY item.name,item.id LIMIT 10`,
    [org.id],
  );
  assert.ok(Number.isFinite(catalogPlan.rows[0]["QUERY PLAN"][0]["Execution Time"]));
  const { chromium } = await import(
    process.env.PLAYWRIGHT_MODULE_PATH ||
      pathToFileURL(
        path.join(
          os.homedir(),
          ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs",
        ),
      ).href
  );
  browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe",
  });
  const readerContext = await browser.newContext({ viewport: { width: 1366, height: 950 } });
  await readerContext.addCookies([
    { name: "sitou_session", value: readerCookie.slice(14), url: base },
  ]);
  const readerPage = await readerContext.newPage();
  await readerPage.goto(base + "/dashboard");
  await readerPage.getByText("Dashboard monitoring", { exact: true }).waitFor();
  await readerPage.goto(base+"/inventory/stock");
  await readerPage.getByText("Persediaan per gudang",{exact:true}).waitFor();
  await readerPage.getByRole("button",{name:/Kartu Stok/}).first().waitFor();
  assert.equal(await readerPage.getByRole("button",{name:/Atur minimum/}).count(),0);
  assert.equal(await readerPage.getByRole("button",{name:/Tambah transaksi/}).count(),0);
  assert.equal(
    await readerPage
      .locator("span:visible")
      .filter({ hasText: /^Data Master$/ })
      .count(),
    0,
  );
  await readerContext.close();
  for (const width of [320, 375, 768, 1024, 1366, 1920]) {
    const context = await browser.newContext({ viewport: { width, height: 950 } });
    await context.addCookies([
      { name: "sitou_session", value: combinedCookie.slice(14), url: base },
    ]);
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(base + "/dashboard");
    await page.getByText("Dashboard monitoring", { exact: true }).waitFor();
    assert.equal(await page.getByText("Operasional stabil", { exact: true }).count(), 0);
    if (width < 1200) {
      await page.getByRole("button", { name: "Buka menu navigasi" }).click();
    }
    await page
      .locator("span:visible")
      .filter({ hasText: /^Inventaris$/ })
      .first()
      .waitFor();
    await page.goto(base + "/inventory/catalog?tab=warehouses");
    await page.waitForURL(/master-data\/inventory-warehouses/);
    await page.getByRole("heading", { name: "Gudang", exact: true }).waitFor();
    assert.equal(await page.getByRole("tab").count(), 0);
    await page.getByText("Gudang Bersehati", { exact: true }).first().waitFor();
    await page.getByRole("button", { name: /Tambah gudang$/ }).waitFor();
    assert.equal(await page.getByRole("button", { name: /Tambah gudang$/ }).count(), 1);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
      false,
    );
    if (width === 320 || width === 1366)
      await page.screenshot({
        path: path.join(screenshots, `warehouse-${width}.png`),
        fullPage: true,
      });
    if (width === 320) {
      const card = page.locator("[data-responsive-card]").filter({ hasText: "Gudang Bersehati" });
      await card.getByRole("button", { name: "Buka menu aksi" }).click();
      await page
        .locator(".ant-dropdown-menu-item")
        .filter({ hasText: /^Edit gudang$/ })
        .click();
      await page.waitForFunction(() =>
        [...document.querySelectorAll("button")].some(
          (button) => button.textContent.trim() === "Simpan gudang" && !button.disabled,
        ),
      );
      await page.locator(".ant-dropdown:visible").waitFor({ state: "hidden" });
      await page.screenshot({
        path: path.join(screenshots, "warehouse-form-320.png"),
        fullPage: true,
      });
      await page.getByRole("button", { name: "Batal", exact: true }).click();
      await page.getByRole("dialog").waitFor({ state: "hidden" });
    }
    await page.goto(base + "/master-data/inventory-items");
    await page.getByRole("heading", { name: "Barang Persediaan", exact: true }).waitFor();
    await page.getByText("Kertas HVS A4", { exact: true }).first().waitFor();
    if (width === 320) {
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
        false,
      );
      await page.screenshot({
        path: path.join(screenshots, "inventory-gallery-320.png"),
        fullPage: true,
      });
    }
    if (width < 768) {
      const itemCard = page
        .locator("[data-inventory-item-card]")
        .filter({ hasText: "Kertas HVS A4" });
      await itemCard.getByRole("img", { name: "Foto Kertas HVS A4 belum tersedia" }).waitFor();
      assert.equal(await itemCard.getByRole("button", { name: /Perbesar foto barang/ }).count(), 0);
    } else {
      const itemCard = page
        .locator("[data-inventory-item-card]")
        .filter({ hasText: "Kertas HVS A4" });
      await itemCard.getByRole("img", { name: "Foto Kertas HVS A4 belum tersedia" }).waitFor();
    }
    await page.getByRole("button", { name: /Tambah barang$/ }).waitFor();
    assert.equal(await page.getByRole("button", { name: /Tambah barang$/ }).count(), 1);
    if (width === 320) {
      const card = page.locator("[data-inventory-item-card]").filter({ hasText: "Kertas HVS A4" });
      await card.getByRole("button", { name: "Edit atau atur barang Kertas HVS A4" }).click();
      await page
        .locator(".ant-dropdown-menu-item")
        .filter({ hasText: /^Atur barang di gudang$/ })
        .click();
      const dialog = page.getByRole("dialog", { name: "Atur barang di gudang" });
      assert.equal(await dialog.getByText("Barang aktif di gudang ini").count(), 0);
      assert.equal(await dialog.getByText("Barang tidak aktif di gudang ini").count(), 0);
      try {
        await dialog.getByLabel("Gudang", { exact: true }).click();
      } catch (error) {
        await page.screenshot({
          path: path.join(screenshots, "item-warehouse-failed.png"),
          fullPage: true,
        });
        console.log(
          "Pengaturan gudang:",
          page.url(),
          (await page.locator("body").innerText()).slice(-2200),
          errors,
          screenshots,
        );
        throw error;
      }
      await page
        .locator(".ant-select-item-option-content")
        .filter({ hasText: /^Gudang Bersehati$/ })
        .click();
      await dialog.getByLabel("Batas stok minimum (Rim)").fill("15");
      assert.equal(await dialog.getByLabel("Batas stok minimum (Rim)").inputValue(), "15");
      await dialog.getByText("Batas stok minimum menentukan kapan peringatan muncul").waitFor();
      await dialog.getByText("Barang aktif di gudang ini").waitFor();
      const minimumBox = await dialog.getByLabel("Batas stok minimum (Rim)").boundingBox();
      const minimumNoticeBox = await dialog
        .getByRole("status")
        .filter({ hasText: "Batas stok minimum menentukan kapan peringatan muncul" })
        .boundingBox();
      assert.ok(minimumNoticeBox.y >= minimumBox.y + minimumBox.height + 12);
      assert.equal(await dialog.getByText("Barang digunakan di gudang ini").count(), 0);
      const warehouseStatusNotice = dialog.getByRole("group", {
        name: /Barang aktif di gudang ini/,
      });
      const statusNoticeBox = await warehouseStatusNotice.boundingBox();
      assert.ok(statusNoticeBox.y >= minimumNoticeBox.y + minimumNoticeBox.height + 16);
      assert.equal(
        await warehouseStatusNotice.getByRole("switch").getAttribute("aria-checked"),
        "true",
      );
      const activeSwitchColor = await warehouseStatusNotice
        .getByRole("switch")
        .evaluate((element) => getComputedStyle(element).backgroundColor);
      const [red, green, blue] = activeSwitchColor.match(/[\d.]+/g).map(Number);
      assert.ok(
        green > red * 2 && green > blue * 1.5,
        `Switch aktif harus hijau: ${activeSwitchColor}`,
      );
      await warehouseStatusNotice.getByRole("switch").click();
      await dialog.getByText("Barang tidak aktif di gudang ini").waitFor();
      await dialog
        .getByText(/barang tidak dapat dipilih atau digunakan pada transaksi stok/)
        .waitFor();
      await dialog
        .getByRole("group", { name: /Barang tidak aktif di gudang ini/ })
        .getByRole("switch")
        .click();
      await dialog.getByText("Barang aktif di gudang ini").waitFor();
      await page.locator(".ant-select-dropdown:visible").waitFor({ state: "hidden" });
      await page.screenshot({
        path: path.join(screenshots, "item-warehouse-form-320.png"),
        fullPage: true,
      });
      await dialog.getByRole("button", { name: "Simpan pengaturan", exact: true }).click();
      await dialog.waitFor({ state: "hidden" });
      assert.equal(
        (
          await db.query(
            "SELECT minimum_stock::text FROM inventory_item_warehouses WHERE organization_id=$1 AND item_id=$2 AND warehouse_id=$3",
            [org.id, item.id, cabang.id],
          )
        ).rows[0].minimum_stock,
        "15.000",
      );
      await page
        .locator("[data-inventory-item-card]")
        .filter({ hasText: "Kertas HVS A4" })
        .getByText("15 Rim")
        .waitFor();
    }
    await page.goto(base + "/inventory/stock");
    await page.getByText("Stok Barang", { exact: true }).last().waitFor();
    assert.equal(await page.getByRole("button", { name: /Catat barang/ }).count(), 0);
    await page.goto(base + "/inventory/transactions");
    await page.getByRole("navigation", { name: "Navigasi halaman data" }).waitFor();
    await page.getByRole("combobox", { name: "Jumlah baris per halaman" }).waitFor();
    await page.getByRole("heading", { name: "Transaksi Barang", exact: true }).waitFor();
    await page.getByText("Riwayat transaksi", { exact: true }).waitFor();
    await page.getByText("Barang keluar", { exact: true }).first().waitFor();
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    if (width === 320 || width === 1366)
      await page.screenshot({
        path: path.join(screenshots, `transactions-${width}.png`),
        fullPage: true,
      });
    if (width === 1366) {
      const filterSection = page
        .locator("section")
        .filter({ has: page.getByRole("heading", { name: "Cari transaksi" }) });
      const kindSearch = filterSection.locator(".ant-select").nth(1).locator("input");
      await kindSearch.click();
      await kindSearch.fill("Barang kel");
      await page
        .locator(".ant-select-dropdown:visible .ant-select-item-option-content")
        .filter({ hasText: "Barang keluar" })
        .waitFor();
      await kindSearch.fill("");
      await kindSearch.press("Escape");
      const ledgerHeader = page
        .getByRole("list", { name: "Riwayat transaksi barang" })
        .locator('[aria-hidden="true"]')
        .first();
      assert.deepEqual(await ledgerHeader.locator("p").allInnerTexts(), [
        "Tanggal transaksi",
        "Transaksi",
        "Gudang",
        "Barang",
        "Perubahan stok",
        "Status",
        "Disimpan oleh",
        "Aksi",
      ]);
      await page.getByRole("combobox", { name: "Jumlah baris per halaman" }).click();
      await page
        .locator(".ant-select-dropdown:visible .ant-select-item-option-content")
        .filter({ hasText: "10 / halaman" })
        .click();
      await page.waitForFunction(() => document.querySelectorAll('[role="listitem"]').length <= 10);
      await page
        .getByText(/Total: \d+ data/)
        .last()
        .waitFor();
      const searchField = page.getByPlaceholder("Barang, referensi, gudang, atau petugas");
      await searchField.fill("QA-BUKTI-GAMBAR-001");
      const proofRow = page.getByRole("listitem").filter({ hasText: "QA-BUKTI-GAMBAR-001" });
      await proofRow.getByRole("button", { name: /Lihat detail/ }).click();
      const proofDetail = page.getByRole("dialog", { name: "Barang masuk" });
      const proofImage = proofDetail.getByRole("img", { name: "Bukti pembelian" });
      assert.ok((await proofImage.boundingBox()).width > 150);
      await page.screenshot({
        path: path.join(screenshots, "transaction-detail-image-1366.png"),
        fullPage: true,
      });
      await proofDetail.getByRole("button", { name: "Tutup modal" }).click();
      await searchField.fill("");
    }
    await page.goto(base+"/inventory/stock");
    await page.getByRole("button",{name:/Kartu Stok/}).first().waitFor();
    assert.equal(await page.getByRole("button",{name:/Tambah transaksi/}).count(),0);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    if(width===320||width===1366)await page.screenshot({path:path.join(screenshots,`stock-${width}.png`),fullPage:true});
    await page.getByRole("button",{name:/Kartu Stok/}).first().click();
    const stockDialog=page.getByRole("dialog",{name:/Kartu Stok/});
    await stockDialog.getByText("Pergerakan barang",{exact:true}).waitFor();
    await stockDialog.getByRole("button",{name:"Tutup modal"}).click();
    if(width===1366){
      const minimumBefore=expect(await req(stockUrl,employeeCookie),200).data.find((row)=>row.item_id===item.id);
      await page.getByRole("button",{name:/Atur minimum/}).first().click();
      const minimumDialog=page.getByRole("dialog",{name:"Atur batas minimum"});
      await minimumDialog.getByRole("spinbutton",{name:"Batas minimum"}).fill("5");
      await minimumDialog.getByRole("button",{name:"Simpan minimum",exact:true}).click();
      await minimumDialog.waitFor({state:"hidden"});
      const updatedStock=expect(await req(stockUrl,employeeCookie),200).data.find((row)=>row.item_id===item.id);
      assert.equal(updatedStock.minimum_stock,"5.000");
      assert.equal(updatedStock.quantity,"3.000");
      expect(await req(`${catalog}/items/${item.id}/warehouses`,employeeCookie,"PUT",{
        organizationId:Number(org.id),warehouseId:Number(updatedStock.warehouse_id),minimumStock:Number(minimumBefore.minimum_stock),isActive:updatedStock.link_active,version:updatedStock.version,
      }),200);
    }
    await page.goto(base+"/inventory/transactions");
    await page.getByText("Tambah transaksi", { exact: true }).first().click();
    const transactionDialog = page.getByRole("dialog").filter({hasText:"Draft tidak mengubah stok."});
    await transactionDialog.getByText("Silakan pilih jenis transaksi").waitFor();
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    if (width === 320 || width === 1366)
      await page.screenshot({
        path: path.join(screenshots, `transaction-form-${width}.png`),
        fullPage: true,
      });
    if (width === 320) {
      await transactionDialog.locator("button").filter({ hasText: "Saldo awal" }).first().click();
      await transactionDialog.getByRole("button", { name: "Lanjut", exact: true }).click();
      await transactionDialog
        .getByText("Pilih gudang dan tanggal acuan stok", { exact: false })
        .waitFor();
      await transactionDialog.getByText("Draft aman tersimpan", { exact: true }).waitFor();
      const back = transactionDialog.getByRole("button", { name: "Kembali", exact: true });
      const next = transactionDialog.getByRole("button", { name: "Lanjut", exact: true });
      for (const button of [
        transactionDialog.getByRole("button", { name: "Simpan draft & tutup" }),
        back,
        next,
      ]) {
        const rect = await button.boundingBox();
        assert.ok(rect.width > 230 && rect.width < 320, "Tombol footer mobile harus lebar penuh");
      }
      assert.ok(
        (await back.boundingBox()).y >
          (
            await transactionDialog
              .getByRole("button", { name: "Simpan draft & tutup" })
              .boundingBox()
          ).y +
            44,
      );
      assert.ok((await next.boundingBox()).y > (await back.boundingBox()).y + 44);
      const warehouseSearch = transactionDialog.locator(
        '[data-field="warehouseId"] input[role="combobox"]',
      );
      await warehouseSearch.click();
      const firstWarehouseOption = page.locator(".ant-select-item-option-content").first();
      await firstWarehouseOption.waitFor();
      const warehouseLabel = await firstWarehouseOption.innerText();
      await warehouseSearch.fill(warehouseLabel.slice(0, 4));
      await page
        .locator(".ant-select-item-option-content")
        .filter({ hasText: warehouseLabel })
        .first()
        .waitFor();
      await warehouseSearch.fill("");
      await transactionDialog.getByPlaceholder("Keterangan tambahan untuk riwayat transaksi").fill("BA-LAMA-001");
    }
    if (width === 320) await transactionDialog.getByRole("button", { name: "Tutup modal" }).click();
    else await transactionDialog.getByRole("button", { name: "Simpan draft & tutup" }).click();
    if (width === 320) {
      await page.getByText("Tambah transaksi", { exact: true }).first().click();
      const resumed = page.getByRole("dialog").filter({hasText:"Draft tidak mengubah stok."});
      await resumed
        .getByText("Pilih gudang dan tanggal acuan stok", { exact: false })
        .waitFor();
      assert.equal(
        await resumed.getByPlaceholder("Keterangan tambahan untuk riwayat transaksi").inputValue(),
        "BA-LAMA-001",
      );
      await resumed.getByRole("button", { name: "Kembali", exact: true }).click();
      await resumed.locator("button").filter({ hasText: "Barang keluar" }).first().click();
      assert.equal(await page.getByText("Ganti jenis transaksi?", { exact: true }).count(), 0);
      await resumed.getByRole("button", { name: "Lanjut", exact: true }).click();
      const switchDialog = page.getByRole("dialog", { name: "Ganti jenis transaksi?" });
      const cancelSwitch = switchDialog.getByRole("button", { name: "Batal" });
      const confirmSwitch = switchDialog.getByRole("button", { name: "Ganti jenis", exact: true });
      assert.ok((await cancelSwitch.boundingBox()).width > 230);
      assert.ok((await confirmSwitch.boundingBox()).width > 230);
      assert.ok((await confirmSwitch.boundingBox()).y > (await cancelSwitch.boundingBox()).y + 44);
      await cancelSwitch.click();
      await resumed.locator("button").filter({ hasText: "Saldo awal" }).first().click();
      await resumed.getByRole("button", { name: "Lanjut", exact: true }).click();
      assert.equal(
        await resumed.getByPlaceholder("Keterangan tambahan untuk riwayat transaksi").inputValue(),
        "BA-LAMA-001",
      );
      await resumed.getByRole("button", { name: "Kembali", exact: true }).click();
      await resumed.locator("button").filter({ hasText: "Barang keluar" }).first().click();
      await resumed.getByRole("button", { name: "Lanjut", exact: true }).click();
      await page.screenshot({
        path: path.join(screenshots, "transaction-switch-confirm.png"),
        fullPage: true,
      });
      await switchDialog.getByText("Ganti jenis transaksi?", { exact: true }).waitFor();
      await confirmSwitch.click();
      assert.equal(await resumed.getByPlaceholder("Keterangan tambahan untuk riwayat transaksi").inputValue(), "");
      assert.equal(await resumed.getByText("Lampiran draft tersimpan privat",{exact:true}).count(),0);
      const requestUpload = resumed
        .getByText("Dokumen permintaan (PDF, opsional)")
        .locator("..")
        .locator(".ant-upload-drag");
      const handoverLabel = resumed.getByText("Foto serah terima (opsional)");
      const requestUploadBox = await requestUpload.boundingBox();
      const handoverLabelBox = await handoverLabel.boundingBox();
      assert.ok(
        handoverLabelBox.y - (requestUploadBox.y + requestUploadBox.height) >= 24,
        `Dua unggahan harus memiliki jarak aman; jarak aktual ${handoverLabelBox.y - (requestUploadBox.y + requestUploadBox.height)} px`,
      );
      const handoverField = handoverLabel.locator("..");
      const handoverUploadBox = await handoverField.locator(".ant-upload-drag").boundingBox();
      const notesLabelBox = await resumed.getByText("Catatan (opsional)",{exact:true}).boundingBox();
      assert.ok(
        notesLabelBox.y - (handoverUploadBox.y + handoverUploadBox.height) >= 24,
        `Catatan harus berjarak aman dari unggahan; jarak aktual ${notesLabelBox.y - (handoverUploadBox.y + handoverUploadBox.height)} px`,
      );
      await handoverField.locator('input[type="file"]').setInputFiles({
        name: "serah-terima.png", mimeType: "image/png", buffer: image,
      });
      const handoverPreview = resumed.getByRole("img", { name: "Pratinjau serah-terima.png", exact: true });
      await handoverPreview.waitFor();
      await page.waitForFunction(() => [...document.images].some((img) => img.alt === "Pratinjau serah-terima.png" && img.naturalWidth > 0));
      await requestUpload.locator('input[type="file"]').setInputFiles({
        name: "permintaan.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%%EOF"),
      });
      await resumed.getByText("permintaan.pdf", { exact: true }).waitFor();
      assert.equal(await resumed.getByRole("img", { name: "Pratinjau permintaan.pdf" }).count(), 0);
      await resumed.getByRole("button", { name: "Simpan draft & tutup" }).click();
      await page.getByText("Tambah transaksi", { exact: true }).first().click();
      await handoverPreview.waitFor();
      await resumed.getByText("permintaan.pdf", { exact: true }).waitFor();
      await resumed.getByRole("button", { name: "Buang draft & mulai ulang" }).click();
      await page
        .getByRole("dialog", { name: "Buang draft dan mulai ulang?" })
        .getByRole("button", { name: "Buang draft", exact: true })
        .click();
      const fresh = page.getByRole("dialog").filter({hasText:"Draft tidak mengubah stok."});
      await fresh.getByText("Silakan pilih jenis transaksi").waitFor();
      item = expect(await multipartPhoto({...itemInput,version:(await getItem()).version},image),200);
      const previewItem=await getItem();
      const imageDetail=expect(await req(`${transactions}/${issue.transactionId}?organizationId=${org.id}`,employeeCookie),200);
      assert.equal(imageDetail.lines.find((line)=>line.itemId===item.id).photo_file_id,previewItem.photo_file_id);
      await fresh.locator("button").filter({ hasText: "Barang masuk" }).first().click();
      await fresh.getByRole("button", { name: "Lanjut", exact: true }).click();
      const proofField = fresh.getByText("Bukti pembelian (gambar, opsional)").locator("..");
      await proofField.locator('input[type="file"]').setInputFiles({
        name: "bukti-beli.png", mimeType: "image/png", buffer: image,
      });
      await fresh.getByRole("img", { name: "Pratinjau bukti-beli.png", exact: true }).waitFor();
      await page.waitForFunction(() => [...document.images].some((img) => img.alt === "Pratinjau bukti-beli.png" && img.naturalWidth > 0));
      await page.screenshot({ path: path.join(screenshots, "proof-upload-preview.png"), fullPage: true });
      await proofField.getByRole("button", { name: /^(eye )?Lihat gambar$/ }).click();
      await page.getByRole("dialog").last().getByRole("button", { name: "Tutup modal" }).click();
      await proofField.getByRole("button", { name: /^(delete )?Hapus file$/ }).click();
      await fresh.getByRole("img", { name: "Pratinjau bukti-beli.png", exact: true }).waitFor({ state: "hidden" });
      await page.setViewportSize({width:1366,height:950});
      const referenceRect=await fresh.getByRole("textbox",{name:"Nomor dokumen penerimaan (opsional)",exact:true}).boundingBox();
      const warehouseRect=await fresh.locator('[data-field="warehouseId"] .ant-select').boundingBox();
      assert.ok(Math.abs(referenceRect.width-warehouseRect.width)<8,"Nomor referensi desktop memakai lebar satu kolom");
      await fresh.locator('[data-field="warehouseId"] input[role="combobox"]').click();
      await page.locator(".ant-select-dropdown:visible .ant-select-item-option-content").filter({hasText:cabang.name}).first().click();
      const transactionDateInput=fresh.locator('[data-field="occurredOn"] input');
      const localDateText=new Intl.DateTimeFormat("id-ID",{day:"2-digit",month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(`${today}T12:00:00Z`));
      await transactionDateInput.fill(localDateText);
      await transactionDateInput.press("Enter");
      await fresh.getByRole("button",{name:"Lanjut",exact:true}).click();
      await fresh.getByRole("button",{name:/Tambah barang/}).click();
      const quantityInput=fresh.locator('[data-field="lines.0.quantity"] input');
      assert.equal(await quantityInput.isDisabled(),true);
      const itemSearch=fresh.locator('[data-field="lines.0.itemId"] input[role="combobox"]');
      await itemSearch.fill(previewItem.code);
      await page.locator(".ant-select-dropdown:visible .ant-select-item-option-content").filter({hasText:previewItem.name}).first().click();
      assert.equal(await quantityInput.isDisabled(),false);
      await fresh.getByText("Stok gudang saat ini: 3 Rim",{exact:true}).waitFor();
      await quantityInput.fill("6");
      const amountRect=await fresh.locator('[data-field="lines.0.quantity"] .ant-input-number').boundingBox();
      const deleteRect=await fresh.getByRole("button",{name:"Hapus barang 1",exact:true}).boundingBox();
      assert.ok(Math.abs((amountRect.y+amountRect.height/2)-(deleteRect.y+deleteRect.height/2))<5,"Tombol hapus sejajar input jumlah");
      await fresh.getByRole("button",{name:`Perbesar foto ${previewItem.name}`,exact:true}).click();
      await page.getByRole("dialog").last().getByRole("img",{name:`Foto ${previewItem.name}`,exact:true}).waitFor();
      await page.getByRole("dialog").last().getByRole("button",{name:"Tutup modal"}).click();
      assert.equal(await quantityInput.inputValue(),"6");
      await fresh.getByRole("button",{name:"Lanjut",exact:true}).click();
      await fresh.getByText("Periksa sebelum menyimpan",{exact:true}).waitFor();
      await fresh.getByRole("region",{name:"Rincian barang masuk"}).getByRole("listitem").getByText(previewItem.name,{exact:true}).waitFor();
      const receiptReviewItem=fresh.getByRole("region",{name:"Rincian barang masuk"}).getByRole("listitem");
      await receiptReviewItem.getByText("Kategori",{exact:true}).waitFor();
      await receiptReviewItem.getByText(categoryInput.name,{exact:true}).waitFor();
      await receiptReviewItem.getByText("Satuan dasar",{exact:true}).waitFor();
      await receiptReviewItem.getByText(unitInput.name,{exact:true}).waitFor();
      await receiptReviewItem.getByText("Perubahan stok gudang",{exact:true}).waitFor();
      await fresh.getByRole("region",{name:"Rincian barang masuk"}).getByText("9 Rim",{exact:true}).waitFor();
      assert.equal(await fresh.getByText("Saldo akan dihitung ulang oleh sistem",{exact:true}).count(),0);
      assert.equal(await fresh.getByRole("button",{name:"Simpan transaksi",exact:true}).isEnabled(),true);
      await page.screenshot({path:path.join(screenshots,"transaction-review-1366.png"),fullPage:true});
      await page.setViewportSize({width:320,height:950});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      await page.screenshot({path:path.join(screenshots,"transaction-review-320.png"),fullPage:true});
      await fresh.getByRole("button",{name:"Simpan draft & tutup",exact:true}).click();
      await page.getByText("Tambah transaksi",{exact:true}).first().click();
      await fresh.getByRole("region",{name:"Rincian barang masuk"}).getByText("9 Rim",{exact:true}).waitFor();
      assert.equal(await fresh.getByRole("button",{name:"Simpan transaksi",exact:true}).isEnabled(),true);
      item = expect(await req(`${catalog}/items/${item.id}`,superadmin.cookie,"PATCH",{...itemInput,version:(await getItem()).version,photoAction:"remove"}),200);
      await fresh.getByRole("button", { name: "Buang draft & mulai ulang" }).click();
      await page.getByRole("dialog", { name: "Buang draft dan mulai ulang?" })
        .getByRole("button", { name: "Buang draft", exact: true }).click();
      await fresh.getByText("Silakan pilih jenis transaksi").waitFor();
      await fresh.getByRole("button", { name: "Tutup modal" }).click();
      await page.getByText("Tambah transaksi",{exact:true}).first().click();
      await fresh.locator("button").filter({hasText:"Pengembalian ke gudang"}).first().click();
      await fresh.getByRole("button",{name:"Lanjut",exact:true}).click();
      assert.equal(await fresh.locator('[data-field="occurredOn"] input').inputValue(),localDateText);
      assert.equal(await fresh.locator('[data-field="lateReason"]').count(),0);
      await fresh.locator('[data-field="warehouseId"] input[role="combobox"]').click();
      await page.locator(".ant-select-dropdown:visible .ant-select-item-option-content").filter({hasText:cabang.name}).first().click();
      const returnSelect=fresh.locator('[data-field="sourceTransactionId"] input[role="combobox"]');
      await returnSelect.fill("Kertas HVS");
      await page.locator(".ant-select-dropdown:visible .ant-select-item-option-content").filter({hasText:"Kertas HVS A4 · 3 Rim"}).first().click();
      await fresh.getByRole("button",{name:/Lihat detail transaksi/}).click();
      const sourceDialog=page.getByRole("dialog",{name:"Detail transaksi penyaluran"});
      await sourceDialog.getByText(/Masih dapat dikembalikan: 2 Rim/).waitFor();
      await sourceDialog.getByText("Lokasi tujuan",{exact:true}).waitFor();
      await sourceDialog.getByText(recipientName,{exact:true}).waitFor();
      await sourceDialog.getByRole("button",{name:"Tutup",exact:true}).click();
      await fresh.getByRole("button",{name:"Lanjut",exact:true}).click();
      const returnQuantity=fresh.getByRole("spinbutton",{name:"Jumlah Kertas HVS A4",exact:true});
      await returnQuantity.waitFor();
      assert.equal(await returnQuantity.inputValue(),"2");
      assert.equal(await fresh.getByRole("button",{name:/Tambah barang|Hapus barang/}).count(),0);
      assert.equal(await fresh.locator('[data-field="lines.0.itemId"]').count(),0);
      await returnQuantity.fill("1");
      await page.setViewportSize({width:1366,height:950});
      await page.screenshot({path:path.join(screenshots,"return-items-1366.png"),fullPage:true});
      await page.setViewportSize({width:320,height:950});
      await fresh.getByRole("button",{name:"Lanjut",exact:true}).click();
      await fresh.getByRole("region",{name:"Rincian barang kembali"}).getByRole("listitem").getByText("1 Rim",{exact:true}).waitFor();
      await fresh.getByRole("region",{name:"Rincian barang kembali"}).getByRole("listitem").getByText(categoryInput.name,{exact:true}).waitFor();
      await fresh.getByText("Tanggal penyaluran sebelumnya",{exact:true}).waitFor();
      await fresh.getByText("Tanggal pengembalian ke gudang",{exact:true}).waitFor();
      await fresh.getByRole("region",{name:"Rincian barang kembali"}).getByText("4 Rim",{exact:true}).waitFor();
      await fresh.getByRole("button",{name:"Simpan draft & tutup",exact:true}).click();
      await page.getByText("Tambah transaksi",{exact:true}).first().click();
      await fresh.getByRole("region",{name:"Rincian barang kembali"}).getByRole("listitem").getByText("1 Rim",{exact:true}).waitFor();
      await fresh.getByRole("button",{name:"Buang draft & mulai ulang"}).click();
      await page.getByRole("dialog",{name:"Buang draft dan mulai ulang?"}).getByRole("button",{name:"Buang draft",exact:true}).click();
      await fresh.getByText("Silakan pilih jenis transaksi").waitFor();
      await fresh.getByRole("button",{name:"Tutup modal"}).click();
    }
    assert.deepEqual(errors, []);
    await context.close();
  }
  const context = await browser.newContext({ viewport: { width: 1366, height: 1000 } });
  await context.addCookies([{ name: "sitou_session", value: hrd.cookie.slice(14), url: base }]);
  const page = await context.newPage();
  await page.goto(base + "/access/accounts");
  const accountRow = page.getByRole("row").filter({ hasText: input.username });
  await accountRow.getByRole("button", { name: "Buka menu aksi" }).click();
  await page
    .locator(".ant-dropdown-menu-item")
    .filter({ hasText: /^Edit$/ })
    .click();
  await page.getByRole("heading", { name: "Akses fitur", exact: true }).waitFor();
  await page.waitForFunction(() =>
    [...document.querySelectorAll("button")].some(
      (button) => button.textContent.trim() === "Simpan akun" && !button.disabled,
    ),
  );
  await page.locator(".ant-dropdown:visible").waitFor({ state: "hidden" });
  assert.equal(await page.getByLabel("Fitur dan izin", { exact: true }).count(), 2);
  assert.equal(await page.getByLabel("Fitur dan izin", { exact: true }).first().isDisabled(), true);
  await page.getByLabel("Cakupan gudang", { exact: true }).nth(1).click();
  await page.locator(".ant-select-dropdown:visible").waitFor();
  await page.getByRole("heading", { name: "Akses fitur", exact: true }).click();
  await page.locator(".ant-select-dropdown:visible").waitFor({ state: "hidden" });
  await page.screenshot({ path: path.join(screenshots, "account-packages.png"), fullPage: true });
  for (const width of [375, 320]) {
    await page.setViewportSize({ width, height: 950 });
    await page.screenshot({
      path: path.join(screenshots, `account-check-${width}.png`),
      fullPage: true,
    });
    assert.equal(
      await page.getByRole("dialog").evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        return [...element.querySelectorAll(".ant-select,.ant-input,textarea")].some((field) => {
          const rect = field.getBoundingClientRect();
          return rect.width > 0 && (rect.right > bounds.right || rect.left < bounds.left);
        });
      }),
      false,
      "Field akun melewati batas modal",
    );
    assert.equal(
      await page
        .getByRole("dialog")
        .evaluate((element) => element.scrollWidth > element.clientWidth),
      false,
    );
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
      false,
    );
    if (width === 320)
      await page.screenshot({
        path: path.join(screenshots, "account-packages-320.png"),
        fullPage: true,
      });
  }
  await context.close();
  const adminContext = await browser.newContext({ viewport: { width: 375, height: 950 } });
  await adminContext.addCookies([
    { name: "sitou_session", value: superadmin.cookie.slice(14), url: base },
  ]);
  const adminPage = await adminContext.newPage();
  await adminPage.goto(base + "/master-data/organizations");
  await adminPage
    .locator("[data-responsive-card]")
    .filter({ hasText: "Organisasi Inventaris Uji 0" })
    .getByText("Fitur Inventaris", { exact: true })
    .waitFor();
  await adminPage.screenshot({
    path: path.join(screenshots, "organization-features-375.png"),
    fullPage: true,
  });
  await adminPage
    .locator("[data-responsive-card]")
    .filter({ hasText: "Organisasi Inventaris Uji 0" })
    .getByRole("button", { name: "Buka menu aksi" })
    .click();
  await adminPage
    .locator(".ant-dropdown-menu-item")
    .filter({ hasText: /^Kelola fitur$/ })
    .click();
  await adminPage.waitForFunction(() =>
    [...document.querySelectorAll("button")].some(
      (button) => button.textContent.trim() === "Simpan fitur" && !button.disabled,
    ),
  );
  await adminPage.locator(".ant-dropdown:visible").waitFor({ state: "hidden" });
  const moduleDialog = adminPage.getByRole("dialog", { name: "Fitur organisasi" });
  const moduleExplanation = moduleDialog.getByText(
    "Fitur dapat digunakan oleh akun yang diberi akses. Gudang dan pengaturan akses tetap tersimpan.",
    { exact: true },
  );
  assert.equal(
    await moduleExplanation.evaluate((element) => getComputedStyle(element).textAlign),
    "justify",
  );
  assert.equal(await moduleDialog.getByRole("switch").getAttribute("aria-checked"), "true");
  assert.equal(
    await moduleDialog.evaluate((element) => element.scrollWidth > element.clientWidth),
    false,
  );
  await adminPage.screenshot({ path: path.join(screenshots, "module-375.png"), fullPage: true });
  await moduleDialog.getByRole("switch").click();
  await moduleDialog.getByRole("button", { name: "Simpan fitur" }).click();
  await adminPage
    .getByRole("dialog", { name: "Nonaktifkan Fitur Inventaris?" })
    .getByRole("button", { name: "Batal", exact: true })
    .click();
  assert.equal(
    expect(await req(`${modules}?organizationId=${org.id}`, superadmin.cookie), 200).is_enabled,
    true,
  );
  await adminPage.setViewportSize({ width: 1366, height: 1000 });
  await adminPage.goto(base + "/master-data/organizations");
  await adminPage.getByRole("columnheader", { name: "Fitur aktif", exact: true }).waitFor();
  await adminPage
    .getByRole("row")
    .filter({ hasText: "Organisasi Inventaris Uji 0" })
    .getByText("Fitur Inventaris", { exact: true })
    .waitFor();
  await adminPage.screenshot({
    path: path.join(screenshots, "organization-features-1366.png"),
    fullPage: true,
  });
  const featurePlan = await db.query(
    `EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) SELECT organization.id,
    (SELECT jsonb_agg(jsonb_build_object('code',catalog.code,'name',catalog.name)) FROM organization_modules enabled
      JOIN access_modules catalog ON catalog.code=enabled.module_code WHERE enabled.organization_id=organization.id AND enabled.is_enabled) AS active_features
    FROM organizations organization WHERE organization.id=$1`,
    [org.id],
  );
  assert.ok(Number.isFinite(featurePlan.rows[0]["QUERY PLAN"][0]["Execution Time"]));
  await adminPage.goto(`${base}/inventory/catalog?organizationId=${org.id}&tab=items`);
  await adminPage.getByText("Kertas HVS A4", { exact: true }).waitFor();
  assert.equal(await adminPage.locator(".ant-pagination").count(), 0);
  await adminPage.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await adminPage.waitForFunction(
    () => document.querySelectorAll("[data-inventory-item-card]").length > 10,
  );
  assert.equal(
    await adminPage.evaluate(() => {
      const ids = [...document.querySelectorAll("[data-inventory-item-card]")].map(
        (card) => card.dataset.itemId,
      );
      return ids.length === new Set(ids).size;
    }),
    true,
    "Pemuatan otomatis tidak boleh menduplikasi kartu barang",
  );
  await adminPage.evaluate(() => window.scrollTo(0, 0));
  await adminPage.getByRole("combobox", { name: "Filter gudang barang" }).click();
  await adminPage
    .locator(".ant-select-item-option-content")
    .filter({ hasText: /^Belum didaftarkan$/ })
    .click();
  await adminPage.getByText("Kertas belum terdaftar", { exact: true }).waitFor();
  assert.equal(await adminPage.getByText("Kertas HVS A4", { exact: true }).count(), 0);
  await adminPage.getByRole("button", { name: "Atur ulang" }).click();
  await adminPage.getByText("Kertas HVS A4", { exact: true }).waitFor();
  await adminPage.getByRole("spinbutton", { name: "Batas stok minimum dari" }).fill("14");
  await adminPage.getByRole("spinbutton", { name: "Batas stok minimum sampai" }).fill("15");
  assert.equal(
    await adminPage.getByRole("spinbutton", { name: "Batas stok minimum dari" }).inputValue(),
    "14",
  );
  await adminPage.waitForFunction(
    () => document.querySelectorAll("[data-inventory-item-card]").length === 1,
  );
  await adminPage.getByText("Kertas HVS A4", { exact: true }).waitFor();
  assert.equal(await adminPage.locator("[data-inventory-item-card]").count(), 1);
  await adminPage.getByRole("button", { name: "Atur ulang" }).click();
  await adminPage.getByText("Kertas HVS A4", { exact: true }).waitFor();
  const galleryWidth = await adminPage
    .locator("[data-inventory-item-card]")
    .first()
    .evaluate((element) => ({
      cardRight: element.getBoundingClientRect().right,
      viewportWidth: window.innerWidth,
    }));
  await adminPage.screenshot({
    path: path.join(screenshots, "inventory-limits-1366.png"),
    fullPage: true,
  });
  assert.ok(
    galleryWidth.cardRight <= galleryWidth.viewportWidth + 2,
    `Kartu inventaris melampaui viewport 1366px: ${galleryWidth.cardRight}/${galleryWidth.viewportWidth}`,
  );
  const itemRowUI = adminPage
    .locator("[data-inventory-item-card]")
    .filter({ hasText: "Kertas HVS A4" });
  await itemRowUI.getByRole("button", { name: "Edit atau atur barang Kertas HVS A4" }).click();
  await adminPage
    .locator(".ant-dropdown-menu-item")
    .filter({ hasText: /^Edit barang$/ })
    .click();
  const itemDialog = adminPage.getByRole("dialog", { name: "Edit barang" });
  await itemDialog.getByLabel("Nama", { exact: true }).waitFor();
  const photoCount = (await db.query("SELECT count(*)::int count FROM stored_files")).rows[0].count;
  await itemDialog
    .locator("input[type=file]")
    .setInputFiles({ name: "preview.png", mimeType: "image/png", buffer: image });
  assert.equal(
    (await db.query("SELECT count(*)::int count FROM stored_files")).rows[0].count,
    photoCount,
  );
  await adminPage.screenshot({
    path: path.join(screenshots, "catalog-form-1366.png"),
    fullPage: true,
  });
  await adminPage.setViewportSize({ width: 320, height: 950 });
  assert.equal(
    await itemDialog.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return [...element.querySelectorAll(".ant-select,.ant-input")].some((field) => {
        const rect = field.getBoundingClientRect();
        return rect.width > 0 && (rect.right > bounds.right || rect.left < bounds.left);
      });
    }),
    false,
  );
  await adminPage.screenshot({
    path: path.join(screenshots, "catalog-form-320.png"),
    fullPage: true,
  });
  await itemDialog.getByRole("button", { name: "Batal", exact: true }).click();
  await adminPage
    .getByRole("dialog", { name: "Tutup tanpa menyimpan?" })
    .getByRole("button", { name: "Tutup", exact: true })
    .click();
  assert.equal(
    (await db.query("SELECT count(*)::int count FROM stored_files")).rows[0].count,
    photoCount,
  );
  const currentItem = await getItem();
  expect(await multipartPhoto({ ...itemInput, version: currentItem.version }, image), 200);
  await adminPage.setViewportSize({ width: 1366, height: 950 });
  await adminPage.goto(`${base}/master-data/inventory-items?organizationId=${org.id}`);
  const photoRow = adminPage
    .locator("[data-inventory-item-card]")
    .filter({ hasText: "Kertas HVS A4" });
  await photoRow.getByRole("button", { name: "Perbesar foto barang Kertas HVS A4" }).click();
  const photoPreview = adminPage.getByRole("dialog", { name: "Foto barang" });
  await photoPreview.getByRole("img", { name: "Kertas HVS A4" }).waitFor();
  await photoPreview.getByRole("button", { name: "Tutup modal" }).click();
  await adminPage.setViewportSize({ width: 1366, height: 950 });
  await adminPage.goto(`${base}/master-data/inventory-units?organizationId=${org.id}`);
  await adminPage.getByRole("button", { name: /Tambah satuan$/ }).click();
  const unitDialog = adminPage.getByRole("dialog", { name: "Tambah satuan", exact: true });
  assert.equal(await unitDialog.getByLabel("Kode", { exact: true }).count(), 0);
  await unitDialog.getByLabel("Nama", { exact: true }).fill("Lembar uji UI");
  await adminPage.setViewportSize({ width: 320, height: 950 });
  assert.equal(
    await adminPage.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    false,
  );
  await adminPage.screenshot({ path: path.join(screenshots, "unit-form-320.png"), fullPage: true });
  await unitDialog.getByRole("button", { name: "Simpan satuan", exact: true }).click();
  await unitDialog.waitFor({ state: "hidden" });
  await adminPage.getByText("Lembar uji UI", { exact: true }).first().waitFor();
  await db.query(
    "INSERT INTO organization_modules(organization_id,module_code,is_enabled) VALUES($1,'inventory',true) ON CONFLICT(organization_id,module_code) DO UPDATE SET is_enabled=true",
    [other.id],
  );
  await db.query("UPDATE inventory_categories SET is_active=false WHERE organization_id=$1", [
    other.id,
  ]);
  await adminPage.setViewportSize({ width: 1366, height: 950 });
  const prerequisiteOptions = expect(
    await req(`${catalog}/items?organizationId=${other.id}&options=1`, superadmin.cookie),
    200,
  );
  assert.equal(prerequisiteOptions.canManageCatalog, true);
  await adminPage.goto(`${base}/master-data/inventory-items?organizationId=${other.id}`);
  await adminPage.getByRole("heading", { name: "Barang Persediaan", exact: true }).waitFor();
  try {
    await adminPage.getByRole("button", { name: /Tambah barang$/ }).click();
  } catch (error) {
    await adminPage.screenshot({
      path: path.join(screenshots, "prerequisite-failed.png"),
      fullPage: true,
    });
    console.log(
      "Prasyarat:",
      adminPage.url(),
      (await adminPage.locator("body").innerText()).slice(-1800),
      screenshots,
    );
    throw error;
  }
  const createDialog = adminPage.getByRole("dialog", { name: /Tambah barang$/ });
  await createDialog
    .getByText(
      "Belum ada kategori aktif. Aktifkan atau buat kategori melalui Data Master → Kategori Barang.",
      { exact: true },
    )
    .waitFor();
  await createDialog
    .getByText("Buat satuan terlebih dahulu melalui Data Master → Satuan Barang → Tambah satuan.", {
      exact: true,
    })
    .waitFor();
  for (const width of [320, 375, 768, 1024, 1366, 1920]) {
    await adminPage.setViewportSize({ width, height: 950 });
    const spacing = await createDialog.evaluate((element) =>
      [...element.querySelectorAll(".ant-form-item")]
        .filter(
          (field) =>
            field.querySelector(".ant-select") &&
            field.querySelector(".ant-form-item-extra [data-prerequisite-text]"),
        )
        .map((field) => {
          const control = field.querySelector(".ant-select").getBoundingClientRect();
          const text = field
            .querySelector(".ant-form-item-extra [data-prerequisite-text]")
            .getBoundingClientRect();
          const link = field.querySelector(".ant-form-item-extra button").getBoundingClientRect();
          return {
            gap: text.top - control.bottom,
            linkGap: link.top - text.bottom,
            overflow: control.right > element.getBoundingClientRect().right,
          };
        }),
    );
    assert.equal(spacing.length, 2);
    for (const field of spacing) {
      assert.ok(field.gap >= 7.5, `bantuan terlalu dekat pada ${width}px`);
      assert.ok(field.linkGap >= 7.5, `tautan terlalu dekat pada ${width}px`);
      assert.equal(field.overflow, false);
    }
    if (width === 320 || width === 1366)
      await adminPage.screenshot({
        path: path.join(screenshots, `prerequisite-spacing-${width}.png`),
        fullPage: true,
      });
  }
  await createDialog.getByLabel("Nama", { exact: true }).fill("Isian belum disimpan");
  await createDialog.getByRole("button", { name: "Buka Kategori Barang" }).click();
  const discard = adminPage.getByRole("dialog", { name: "Tutup tanpa menyimpan?" });
  await discard.waitFor();
  assert.match(adminPage.url(), /inventory-items/);
  await discard.getByRole("button", { name: "Tutup", exact: true }).click();
  await adminPage.waitForURL(new RegExp(`inventory-categories\\?organizationId=${other.id}`));
  await adminPage.getByRole("heading", { name: "Kategori Barang", exact: true }).waitFor();
  await adminPage.goto(base + "/access/accounts");
  await adminPage.getByRole("combobox").nth(1).click();
  await adminPage
    .locator(".ant-select-item-option-content")
    .filter({ hasText: /^Organisasi Inventaris Uji 0$/ })
    .click();
  await adminPage.getByPlaceholder("Cari data...").fill("qa_inventory_master");
  const masterAccountRow = adminPage.getByRole("row").filter({ hasText: "qa_inventory_master" });
  await masterAccountRow.getByRole("button", { name: "Buka menu aksi" }).click();
  await adminPage
    .locator(".ant-dropdown-menu-item")
    .filter({ hasText: /^Edit$/ })
    .click();
  const accessDialog = adminPage.getByRole("dialog", { name: "Edit akun organisasi" });
  await accessDialog
    .getByText(
      "Data master digunakan bersama dalam organisasi. Akses operasional diberikan terpisah.",
      { exact: true },
    )
    .waitFor();
  assert.equal(await accessDialog.getByLabel("Cakupan gudang", { exact: true }).count(), 0);
  await accessDialog
    .getByLabel("Gudang yang dapat diakses", { exact: true })
    .waitFor({ state: "hidden" });
  await accessDialog.getByLabel("Fitur dan izin", { exact: true }).click();
  await adminPage
    .locator(".ant-select-item-option-content")
    .filter({ hasText: /^Fitur Inventaris — Pengelola Gudang$/ })
    .click();
  await accessDialog.getByLabel("Gudang yang dapat diakses", { exact: true }).waitFor();
  assert.ok((await accessDialog.innerText()).includes("Pilih Gudang"));
  await accessDialog.getByLabel("Fitur dan izin", { exact: true }).click();
  await adminPage
    .locator(".ant-select-item-option-content")
    .filter({ hasText: /^Fitur Inventaris — Pengelola Master Inventaris$/ })
    .click();
  assert.equal(
    await accessDialog.getByLabel("Gudang yang dapat diakses", { exact: true }).count(),
    0,
  );
  await adminPage.locator(".ant-select-dropdown:visible").waitFor({ state: "hidden" });
  await adminPage.setViewportSize({ width: 320, height: 950 });
  try {
    await adminPage.waitForFunction(
      () => document.documentElement.scrollWidth <= innerWidth,
      null,
      { timeout: 5000 },
    );
  } catch (error) {
    await adminPage.screenshot({
      path: path.join(screenshots, "master-overflow-failed.png"),
      fullPage: true,
    });
    console.log(
      "Overflow master:",
      await adminPage.evaluate(() =>
        [...document.querySelectorAll("body *")]
          .map((element) => ({
            tag: element.tagName,
            css: String(element.className),
            right: element.getBoundingClientRect().right,
          }))
          .filter((value) => value.right > innerWidth + 1)
          .slice(-15),
      ),
      screenshots,
    );
    throw error;
  }
  await adminPage.screenshot({
    path: path.join(screenshots, "master-access-320.png"),
    fullPage: true,
  });
  await accessDialog.getByRole("button", { name: "Batal", exact: true }).click();
  await adminPage
    .getByRole("dialog", { name: "Tutup tanpa menyimpan?" })
    .getByRole("button", { name: "Tutup", exact: true })
    .click();
  await adminPage.goto(`${base}/master-data/inventory-categories?organizationId=${org.id}`);
  for (const width of [320, 375, 768, 1024, 1366, 1920]) {
    await adminPage.setViewportSize({ width, height: 950 });
    await adminPage.getByText(categoryInput.notes, { exact: true }).first().waitFor();
    await adminPage.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth);
    if (width === 320 || width === 1366)
      await adminPage.screenshot({
        path: path.join(screenshots, `category-notes-${width}.png`),
        fullPage: true,
      });
  }
  await adminPage.goto(`${base}/inventory/stock?organizationId=${org.id}`);
  for (const width of [320,375,768,1024,1366,1920]) {
    await adminPage.setViewportSize({width,height:950});
    const search=adminPage.getByRole("textbox",{name:"Cari stok barang"});await search.fill(openingFixtures.manual.name);
    const action=adminPage.getByRole("button",{name:`Koreksi saldo awal ${openingFixtures.manual.name}`,exact:true}).first();await action.waitFor();await action.click();
    const correctionDialog=adminPage.getByRole("dialog",{name:"Koreksi saldo awal",exact:true});
    await correctionDialog.getByLabel("Stok sebelum transaksi pertama",{exact:true}).waitFor();
    assert.equal(await correctionDialog.evaluate((el)=>el.scrollWidth<=el.clientWidth),true,`Koreksi tidak overflow ${width}`);
    await correctionDialog.getByRole("textbox",{name:"Alasan koreksi",exact:true}).fill("Uji preview koreksi tanpa mengubah riwayat.");
    await correctionDialog.getByRole("button",{name:"Periksa perubahan",exact:true}).click();
    await correctionDialog.getByText(/Stok setelah:/).waitFor();
    await correctionDialog.getByRole("button",{name:"Simpan koreksi",exact:true}).waitFor();
    await adminPage.waitForFunction(()=>[...document.querySelectorAll("button")].some((b)=>b.textContent.trim()==="Simpan koreksi"&&!b.disabled));
    if(width===320 || width===1366)await adminPage.screenshot({path:path.join(screenshots,`opening-correction-${width}.png`),fullPage:true});
    await correctionDialog.getByRole("button",{name:"Batal",exact:true}).click();
  }
  const interruptedReceipt=transactionInput("receipt",[{itemId:Number(openingFixtures.manual.id),quantity:1}]);
  expect(await req(`${transactions}/drafts`,superadmin.cookie,"POST",{...interruptedReceipt,currentStep:3}),200);
  await adminPage.goto(`${base}/inventory/transactions?organizationId=${org.id}`);
  await adminPage.getByRole("button",{name:/Tambah transaksi/,exact:false}).first().click();
  const interruptedDialog=adminPage.getByRole("dialog").filter({hasText:"Draft tidak mengubah stok."});
  await interruptedDialog.getByText("Periksa sebelum menyimpan",{exact:true}).waitFor();
  await adminPage.waitForFunction(()=>[...document.querySelectorAll("button")].some((b)=>b.textContent.trim()==="Simpan transaksi"&&!b.disabled));
  let interruptedCommitCount=0;
  await adminPage.route("**/api/inventory/transactions",async(route)=>{
    if(route.request().method()==="POST"){const response=await route.fetch();assert.equal(response.status(),201);interruptedCommitCount++;await route.abort("failed");}else await route.continue();
  });
  await interruptedDialog.getByRole("button",{name:"Simpan transaksi",exact:true}).click();
  await interruptedDialog.waitFor({state:"hidden"});
  assert.equal(interruptedCommitCount,1,"Commit diverifikasi lewat UUID setelah respons terputus, tanpa posting kedua");
  assert.equal((await db.query("SELECT count(*)::int count FROM inventory_transaction_lines WHERE transaction_id=$1",[interruptedReceipt.transactionId])).rows[0].count,1);
  await adminPage.unroute("**/api/inventory/transactions");
  await adminContext.close();
  await verifyHrisAccess({
    req,
    expect,
    db,
    browser,
    base,
    org,
    other,
    superadmin,
    hrd,
    password,
    updateInput,
    employeeProfile,
    screenshots,
  });
  await verifyDirectoryFilters({db,req,expect,org,other,superadmin,actor,browser,base});
  console.log(
    "PASS inventaris: migration/bootstrap, login, permission-scope, delegasi, isolasi, rollback/version/audit, pencabutan, modul, gudang, dan UI 320–1920.",
  );
  console.log("Screenshot uji:", screenshots);
} finally {
  await browser?.close();
  if (clam) await new Promise((resolve) => clam.close(resolve));
  if (server) {
    server.kill();
    await new Promise((resolve) =>
      server.exitCode !== null ? resolve() : server.once("exit", resolve),
    );
  }
  await db?.end();
  assert.ok(path.resolve(uploadRoot).startsWith(path.resolve(screenshots) + path.sep));
  await rm(uploadRoot, { recursive: true, force: true });
  if (created) {
    await admin.query(
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()",
      [databaseName],
    );
    await admin.query(`DROP DATABASE "${databaseName}"`);
  }
  await admin.end();
}
