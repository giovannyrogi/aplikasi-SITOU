import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, mkdtemp } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import os from "node:os";
import dotenv from "dotenv";
import pg from "pg";
import bcrypt from "bcryptjs";
import { createSessionToken } from "../lib/auth/session.js";
dotenv.config({ path: ".env.development", quiet: true });
assert.ok(process.env.PGDATABASE && !/prod/i.test(process.env.PGDATABASE));
const databaseName = "sitou_inventory_test_" + randomUUID().replaceAll("-", "").slice(0, 12);
assert.match(databaseName, /^sitou_inventory_test_[a-f0-9]{12}$/);
const admin = new pg.Client({ database: process.env.PGADMIN_DATABASE || "postgres" });
let db,
  server,
  browser,
  created = false;
const base = "http://127.0.0.1:3004";
const password = "Qa_Inventory1!";
const screenshots = await mkdtemp(path.join(os.tmpdir(), "sitou-inventory-ui-"));
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
  assert.equal(
    (await db.query("SELECT count(*)::int count FROM access_packages")).rows[0].count,
    2,
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
      2,
    );
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
  assert.equal(rows.find((r) => r.id === cabang.id).canEdit, true);
  expect(
    await req(warehouses + "/" + pusat.id, employeeCookie, "PATCH", mutateWarehouse(pusat)),
    403,
  );
  cabang = expect(
    await req(
      warehouses + "/" + cabang.id,
      employeeCookie,
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
    employeeCookie,
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
  assert.equal(expect(await req("/api/access/me", emptyCookie), 200).canCreateWarehouse, true);
  expect(await req(warehouses, emptyCookie, "POST", warehouseInput(org.locations[1], "BARU")), 201);
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
  const { chromium } = await import(
    process.env.PLAYWRIGHT_MODULE_PATH ||
      "file:///C:/Users/GIOVR/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs"
  );
  browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe",
  });
  for (const width of [320, 375, 768, 1024, 1366, 1920]) {
    const context = await browser.newContext({ viewport: { width, height: 950 } });
    await context.addCookies([
      { name: "sitou_session", value: employeeCookie.slice(14), url: base },
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
    await page.goto(base + "/inventory/master-data");
    await page.getByRole("tab", { name: "Gudang", exact: true }).waitFor();
    await page.getByText("Gudang Bersehati", { exact: true }).first().waitFor();
    if (width < 600)
      assert.equal(
        await page
          .locator(".ant-tabs-nav-list")
          .evaluate((element) => getComputedStyle(element).display),
        "grid",
      );
    assert.equal(await page.getByRole("button", { name: "Tambah gudang", exact: true }).count(), 0);
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
    await page.getByRole("tab", { name: "Barang", exact: true }).click();
    await page.waitForURL(/tab=items/);
    await page.goto(base + "/inventory/stock");
    await page.getByText("Stok Barang", { exact: true }).last().waitFor();
    assert.equal(await page.getByRole("button", { name: /Catat barang/ }).count(), 0);
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
  await page.getByText("Paket akses fitur", { exact: true }).waitFor();
  await page.waitForFunction(() =>
    [...document.querySelectorAll("button")].some(
      (button) => button.textContent.trim() === "Simpan akun" && !button.disabled,
    ),
  );
  await page.locator(".ant-dropdown:visible").waitFor({ state: "hidden" });
  assert.equal(await page.getByLabel("Paket akses", { exact: true }).count(), 2);
  assert.equal(await page.getByLabel("Paket akses", { exact: true }).first().isDisabled(), true);
  await page.getByLabel("Cakupan gudang", { exact: true }).nth(1).click();
  await page.locator(".ant-select-dropdown:visible").waitFor();
  await page.getByText("Paket akses fitur", { exact: true }).click();
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
    .getByRole("button", { name: "Buka menu aksi" })
    .click();
  await adminPage
    .locator(".ant-dropdown-menu-item")
    .filter({ hasText: /^Modul organisasi$/ })
    .click();
  await adminPage.waitForFunction(() =>
    [...document.querySelectorAll("button")].some(
      (button) => button.textContent.trim() === "Simpan modul" && !button.disabled,
    ),
  );
  await adminPage.locator(".ant-dropdown:visible").waitFor({ state: "hidden" });
  const moduleDialog = adminPage.getByRole("dialog", { name: "Modul organisasi" });
  const moduleExplanation = moduleDialog.getByText(
    "Aktifkan Inventaris untuk akun yang diberi akses. Saat nonaktif, gudang dan paket tetap tersimpan. Akses pulih setelah modul diaktifkan kembali.",
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
  await moduleDialog.getByRole("button", { name: "Simpan modul" }).click();
  await adminPage
    .getByRole("dialog", { name: "Nonaktifkan Inventaris?" })
    .getByRole("button", { name: "Batal", exact: true })
    .click();
  assert.equal(
    expect(await req(`${modules}?organizationId=${org.id}`, superadmin.cookie), 200).is_enabled,
    true,
  );
  await adminContext.close();
  console.log(
    "PASS inventaris: migration/bootstrap, login, permission-scope, delegasi, isolasi, rollback/version/audit, pencabutan, modul, gudang, dan UI 320–1920.",
  );
  console.log("Screenshot uji:", screenshots);
} finally {
  await browser?.close();
  if (server) {
    server.kill();
    await new Promise((resolve) =>
      server.exitCode !== null ? resolve() : server.once("exit", resolve),
    );
  }
  await db?.end();
  if (created) {
    await admin.query(
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()",
      [databaseName],
    );
    await admin.query(`DROP DATABASE "${databaseName}"`);
  }
  await admin.end();
}
