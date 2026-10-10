import assert from "node:assert/strict";
import path from "node:path";
import { createSessionToken } from "../lib/auth/session.js";

/** Fixtures seluruhnya berada dalam database HTTP terpisah milik runner Inventaris. */
export async function verifyHrisAccess({
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
}) {
  const legacy = expect(
    await req("/api/access/accounts", superadmin.cookie, "POST", {
      organizationId: org.id,
      username: "qa_legacy_accounts_only",
      roleCode: "hrd",
      password,
      confirmPassword: password,
      hrisAccountAccess: "manage",
    }),
    201,
  );
  let primary = expect(
    await req(`/api/access/accounts/${hrd.id}?organizationId=${org.id}`, superadmin.cookie),
    200,
  );
  primary = expect(
    await req(
      `/api/access/accounts/${primary.id}`,
      superadmin.cookie,
      "PATCH",
      updateInput(primary, {
        isHrisAdmin: true,
        hrisPolicyVersion: 0,
        locationScopeMode: "all",
        hrisMenuAccess: [],
      }),
    ),
    200,
  );
  assert.equal(primary.hrisAccess.fullAdmin, true);
  assert.equal(
    expect(
      await req(`/api/access/accounts/${legacy.id}?organizationId=${org.id}`, superadmin.cookie),
      200,
    ).hrisAccess.grants.length,
    14,
  );
  assert.equal(primary.location_scope_mode, "all");
  assert.equal(expect(await req("/api/access/me", hrd.cookie), 200).hris.fullAdmin, true);
  const createHrd = async (name, grants) =>
    expect(
      await req("/api/access/accounts", hrd.cookie, "POST", {
        organizationId: org.id,
        username: name,
        roleCode: "hrd",
        password,
        confirmPassword: password,
        locationScopeMode: "selected",
        locationIds: [org.locations[1]],
        hrisMenuAccess: grants,
      }),
      201,
    );
  let limited = await createHrd("qa_hris_limited", [{ key: "master-positions", level: "read" }]);
  const cookieFor = async (id) =>
    "sitou_session=" +
    (await createSessionToken({
      userId: id,
      roleCode: "hrd",
      organizationId: org.id,
      credentialVersion: 1,
      expiresAt: Date.now() + 600000,
    }));
  const cookie = await cookieFor(limited.id);
  expect(await req("/api/positions", cookie), 200);
  expect(
    await req("/api/positions", cookie, "POST", {
      organizationId: org.id,
      code: "DENY",
      name: "Dilarang",
    }),
    403,
  );
  for (const route of ["/api/employees", "/api/access/accounts"])
    expect(await req(route, cookie), 403);
  assert.deepEqual(expect(await req("/api/dashboard/summary", cookie), 200).sections, []);
  const direct = await fetch(base + "/employees", {
    headers: { Cookie: cookie },
    redirect: "manual",
  });
  assert.ok([307, 308].includes(direct.status));
  assert.match(direct.headers.get("location"), /dashboard/);
  const spoof = await fetch(base + "/api/employees", {
    headers: { Cookie: cookie, "x-sitou-path": "/api/positions", "x-sitou-method": "GET" },
  });
  assert.equal(spoof.status, 403);
  const limitedScope = { locationScopeMode: "selected", locationIds: [org.locations[1]] };
  limited = expect(
    await req(
      `/api/access/accounts/${limited.id}`,
      hrd.cookie,
      "PATCH",
      updateInput(limited, {
        ...limitedScope,
        hrisMenuAccess: [{ key: "master-positions", level: "manage" }],
      }),
    ),
    200,
  );
  assert.ok(
    expect(
      await req("/api/positions", cookie, "POST", {
        organizationId: org.id,
        code: "HRIS_TEST",
        name: "Posisi HRIS Uji",
        isActive: true,
      }),
      201,
    ).id,
  );
  expect(await req(`/api/positions?organizationId=${other.id}`, cookie), 403);
  expect(
    await req(
      `/api/access/accounts/${limited.id}`,
      hrd.cookie,
      "PATCH",
      updateInput(limited, {
        ...limitedScope,
        version: "2020-01-01T00:00:00.000Z",
        hrisMenuAccess: [],
      }),
    ),
    409,
  );
  assert.equal(expect(await req("/api/access/me", cookie), 200).hris.grants[0].level, "manage");
  limited = expect(
    await req(
      `/api/access/accounts/${limited.id}`,
      hrd.cookie,
      "PATCH",
      updateInput(limited, limitedScope),
    ),
    200,
  );
  assert.equal(limited.hrisAccess.grants.length, 1);
  const context = await browser.newContext();
  // Delegasi akun independen dari penggunaan Inventaris; actor tetap dalam cakupan lokasi.
  let operator = await createHrd("qa_account_operator", []);
  operator = expect(
    await req(
      `/api/access/accounts/${operator.id}`,
      hrd.cookie,
      "PATCH",
      updateInput(operator, { ...limitedScope, hrisAccountAccess: "manage" }),
    ),
    200,
  );
  const operatorCookie = await cookieFor(operator.id);
  const operatorAccess = expect(await req("/api/access/me", operatorCookie), 200);
  assert.equal(operatorAccess.canManageAccounts, true);
  assert.equal(operatorAccess.canDelegateNonHris, false);
  assert.equal(operatorAccess.canGrantHris, false);
  expect(await req(`/api/access/accounts/${primary.id}`, operatorCookie), 404);
  expect(
    await req("/api/access/accounts", operatorCookie, "POST", {
      organizationId: org.id,
      username: "qa_illegal_hrd",
      roleCode: "hrd",
      password,
      confirmPassword: password,
    }),
    403,
  );
  const workerProfile = await employeeProfile("HRISWORKER");
  let worker = expect(
    await req("/api/access/accounts", operatorCookie, "POST", {
      organizationId: org.id,
      username: "qa_hris_worker",
      employeeId: workerProfile,
      roleCode: "employee",
      password,
      confirmPassword: password,
    }),
    201,
  );
  const warehouse = (
    await db.query(
      "SELECT id::text FROM inventory_warehouses WHERE organization_id=$1 AND location_id=$2 AND is_active ORDER BY id LIMIT 1",
      [org.id, org.locations[1]],
    )
  ).rows[0];
  assert.ok(warehouse);
  const inventoryGrant = [
    { packageCode: "inventory_manager", scopeMode: "selected", warehouseIds: [warehouse.id] },
  ];
  expect(
    await req(
      `/api/access/accounts/${worker.id}`,
      operatorCookie,
      "PATCH",
      updateInput(worker, { packageAccess: inventoryGrant }),
    ),
    403,
  );
  assert.equal(
    expect(await req(`/api/access/accounts/${worker.id}`, hrd.cookie), 200).updated_at,
    worker.updated_at,
  );
  worker = expect(
    await req(`/api/access/accounts/${worker.id}`, operatorCookie, "PATCH", updateInput(worker)),
    200,
  );
  expect(
    await req(`/api/access/accounts/${worker.id}/password`, operatorCookie, "PATCH", {
      organizationId: org.id,
      password,
      confirmPassword: password,
    }),
    200,
  );
  worker = expect(await req(`/api/access/accounts/${worker.id}`, operatorCookie), 200);
  operator = expect(
    await req(
      `/api/access/accounts/${operator.id}`,
      hrd.cookie,
      "PATCH",
      updateInput(operator, { ...limitedScope, hrisAccountAccess: "manage_and_delegate" }),
    ),
    200,
  );
  assert.deepEqual(expect(await req("/api/access/me", operatorCookie), 200).permissions, []);
  const reference = expect(
    await req(`/api/access/accounts/reference-options?organizationId=${org.id}`, operatorCookie),
    200,
  );
  assert.equal(reference.canGrantHris, false);
  assert.equal(reference.canDelegateNonHris, true);
  worker = expect(
    await req(
      `/api/access/accounts/${worker.id}`,
      operatorCookie,
      "PATCH",
      updateInput(worker, { packageAccess: inventoryGrant }),
    ),
    200,
  );
  assert.equal(worker.packageAccess.length, 1);
  expect(
    await req(
      `/api/access/accounts/${worker.id}`,
      operatorCookie,
      "PATCH",
      updateInput(worker, { hrisMenuAccess: [] }),
    ),
    403,
  );
  expect(
    await req(
      `/api/access/accounts/${worker.id}`,
      operatorCookie,
      "PATCH",
      updateInput(worker, { hrisAccountAccess: "none" }),
    ),
    403,
  );
  expect(
    await req(
      `/api/access/accounts/${worker.id}`,
      operatorCookie,
      "PATCH",
      updateInput(worker, {
        packageAccess: [{ packageCode: "inventory_master", scopeMode: "all" }],
      }),
    ),
    400,
  );
  operator = expect(
    await req(
      `/api/access/accounts/${operator.id}`,
      hrd.cookie,
      "PATCH",
      updateInput(operator, { ...limitedScope, hrisAccountAccess: "manage" }),
    ),
    200,
  );
  worker = expect(
    await req(
      `/api/access/accounts/${worker.id}`,
      operatorCookie,
      "PATCH",
      updateInput(worker, { packageAccess: inventoryGrant }),
    ),
    200,
  );
  expect(
    await req(
      `/api/access/accounts/${worker.id}`,
      operatorCookie,
      "PATCH",
      updateInput(worker, { packageAccess: [] }),
    ),
    403,
  );
  expect(
    await req(
      `/api/access/accounts/${operator.id}`,
      hrd.cookie,
      "PATCH",
      updateInput(operator, { ...limitedScope, hrisAccountAccess: "none" }),
    ),
    200,
  );
  expect(await req("/api/access/accounts", operatorCookie), 403);
  assert.ok(
    (
      await db.query(
        "SELECT 1 FROM audit_logs WHERE organization_id=$1 AND action='hris.account_access.update'",
        [org.id],
      )
    ).rowCount > 0,
  );
  await context.addCookies([{ name: "sitou_session", value: hrd.cookie.slice(14), url: base }]);
  const page = await context.newPage();
  await page.goto(base + "/access/accounts");
  await page.getByText("qa_hris_limited", { exact: false }).first().waitFor();
  await page
    .getByRole("row")
    .filter({ hasText: "qa_hris_limited" })
    .getByRole("button", { name: "Buka menu aksi" })
    .click();
  await page
    .locator(".ant-dropdown-menu-item")
    .filter({ hasText: /^Lihat hak akses$/ })
    .click();
  await page.getByRole("dialog", { name: "Detail hak akses" }).waitFor();
  for (const width of [320, 375, 768, 1024, 1366, 1920]) {
    await page.setViewportSize({ width, height: 950 });
    await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth);
    if ([320, 1366].includes(width))
      await page.screenshot({ path: path.join(screenshots, `access-details-${width}.png`) });
  }
  await page
    .getByRole("dialog", { name: "Detail hak akses" })
    .getByRole("button", { name: "Tutup", exact: true })
    .click();
  await page.getByRole("button", { name: /Tambah akun/ }).click();
  const formDialog = page.getByRole("dialog", { name: "Tambah akun organisasi" });
  await formDialog.getByLabel("Role", { exact: true }).click();
  await page.locator(".ant-select-item-option-content").filter({ hasText: /^HRD$/ }).click();
  await formDialog.getByLabel("Tambahkan fitur", { exact: true }).click();
  await page
    .locator(".ant-select-item-option-content")
    .filter({ hasText: /^HRIS$/ })
    .click();
  await formDialog.getByRole("checkbox", { name: "Data Pegawai", exact: true }).check();
  await formDialog.getByLabel("Tingkat akses Data Pegawai", { exact: true }).click();
  await page
    .locator(".ant-select-item-option-content")
    .filter({ hasText: /^Lihat Saja$/ })
    .click();
  await formDialog.getByText("Akun & Akses", { exact: true }).click();
  const accountToggle = formDialog.getByRole("checkbox", { name: "Akun Organisasi", exact: true });
  const toggleAccount = async (checked) => {
    if ((await accountToggle.isChecked()) !== checked) await accountToggle.click();
    await formDialog
      .getByRole("checkbox", { name: "Akun Organisasi", exact: true, checked })
      .waitFor({ state: "visible" });
  };
  await toggleAccount(true);
  const accountLevel = formDialog.getByLabel("Tingkat akses Akun Organisasi", { exact: true });
  await accountLevel.click();
  await page
    .locator(".ant-select-item-option-content")
    .filter({ hasText: /^Kelola akun Pegawai & akses fitur$/ })
    .click();
  await toggleAccount(false);
  assert.equal(await accountLevel.isDisabled(), true);
  await toggleAccount(true);
  assert.equal(
    await accountLevel.evaluate((element) => element.closest(".ant-select").textContent.trim()),
    "Kelola akun Pegawai",
  );
  await accountLevel.click();
  await page
    .locator(".ant-select-item-option-content")
    .filter({ hasText: /^Kelola akun Pegawai & akses fitur$/ })
    .click();
  for (const label of ["Dashboard", "Kontrak Akan Berakhir", "Proyeksi Pensiun", "Sanksi Pegawai"])
    assert.equal(await formDialog.getByLabel(`Tingkat akses ${label}`, { exact: true }).count(), 0);
  for (const width of [320, 375, 768, 1024, 1366, 1920]) {
    await page.setViewportSize({ width, height: 950 });
    await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth);
    assert.equal(
      await formDialog.evaluate((element) => element.scrollWidth > element.clientWidth),
      false,
    );
    if ([320, 1366].includes(width))
      await page.screenshot({ path: path.join(screenshots, `hris-features-${width}.png`) });
  }
  await page.setViewportSize({ width: 1366, height: 950 });
  await page.evaluate(() => {
    document.documentElement.style.zoom = "200%";
  });
  assert.equal(
    await formDialog.evaluate((element) => element.scrollWidth > element.clientWidth),
    false,
  );
  await page.evaluate(() => {
    document.documentElement.style.zoom = "100%";
  });
  const featureHeader = formDialog
    .locator(".ant-collapse-header")
    .filter({ hasText: /^HRIS/ })
    .first();
  await featureHeader.click();
  await accountLevel.waitFor({ state: "hidden" });
  await featureHeader.click();
  await accountLevel.waitFor({ state: "visible" });
  assert.ok(
    (await accountLevel.evaluate((element) => element.closest(".ant-select").textContent)).includes(
      "akses fitur",
    ),
  );
  await accountToggle.focus();
  await accountToggle.evaluate((element) => element.setAttribute("data-qa", "account-toggle"));
  await accountToggle.press("Space");
  await page.waitForFunction(
    () => document.querySelector('[data-qa="account-toggle"]')?.checked === false,
  );
  await accountToggle.press("Space");
  await page.waitForFunction(
    () => document.querySelector('[data-qa="account-toggle"]')?.checked === true,
  );
  await accountLevel.click();
  await page
    .locator(".ant-select-item-option-content")
    .filter({ hasText: /^Kelola akun Pegawai & akses fitur$/ })
    .click();
  await featureHeader.click();
  await formDialog.getByLabel("Username", { exact: true }).fill("qa_folded_access");
  await formDialog.getByLabel("Password", { exact: true }).fill(password);
  await formDialog.getByLabel("Konfirmasi password", { exact: true }).fill(password);
  await formDialog.getByLabel("Tambahkan fitur", { exact: true }).click();
  await page
    .locator(".ant-select-item-option-content")
    .filter({ hasText: /^Inventaris$/ })
    .click();
  const inventoryHeader = formDialog
    .locator(".ant-collapse-header")
    .filter({ hasText: /^Inventaris/ })
    .first();
  await inventoryHeader.click();
  const invalidPermission = formDialog.getByLabel("Fitur dan izin", { exact: true });
  await invalidPermission.waitFor({ state: "hidden" });
  await formDialog.getByRole("button", { name: "Simpan akun", exact: true }).click();
  await invalidPermission.waitFor({ state: "visible" });
  assert.ok((await formDialog.innerText()).includes("Pilih fitur dan izin pengguna."));
  await formDialog.getByRole("button", { name: "Cabut fitur Inventaris", exact: true }).click();
  const savedRequest = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/access/accounts") && response.request().method() === "POST",
  );
  await formDialog.getByRole("button", { name: "Simpan akun", exact: true }).click();
  const savedResponse = await savedRequest;
  assert.equal(savedResponse.status(), 201);
  const savedData = (await savedResponse.json()).data;
  assert.ok(
    savedData.hrisAccess.grants.some(
      (grant) => grant.key === "employees" && grant.level === "read",
    ),
  );
  assert.equal(savedData.hrisAccess.accountAccess, "manage_and_delegate");
  await context.close();
  await db.query(
    `WITH created AS (INSERT INTO employees(organization_id,employee_no,full_name,national_id,joined_date,employment_status)
    SELECT $1,'QA_PLAN_'||n,'Pegawai QA Query Plan '||n,lpad((900000+n)::text,16,'0'),current_date-700,'active' FROM generate_series(1,1000) n RETURNING id)
    INSERT INTO employee_assignments(organization_id,employee_id,location_id,organization_unit_id,effective_from)
    SELECT $1,id,$2,$3,current_date-700 FROM created`,
    [org.id, org.locations[1], org.unit],
  );
  await db.query("ANALYZE employees");
  await db.query("ANALYZE employee_assignments");
  const queryPlan = await db.query(
    `EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) SELECT count(*) FROM employees employee WHERE employee.organization_id=$1 AND employee.deleted_at IS NULL
    AND EXISTS(SELECT 1 FROM employee_assignments assignment WHERE assignment.organization_id=employee.organization_id AND assignment.employee_id=employee.id AND assignment.assignment_type='primary' AND assignment.effective_from<=current_date AND (assignment.effective_until IS NULL OR assignment.effective_until>=current_date) AND assignment.location_id=ANY($2::bigint[]))`,
    [org.id, [org.locations[1]]],
  );
  assert.ok(Number.isFinite(queryPlan.rows[0]["QUERY PLAN"][0]["Execution Time"]));
  // Akun dengan scope sama tetapi izin berbeda tidak boleh berbagi payload Dashboard.
  const dashboardCases = [
    [
      "data",
      [{ key: "employees", level: "read" }],
      ["employees", "contracts", "retirement", "discipline"],
    ],
    ["contracts", [{ key: "expiring-contracts-report", level: "read" }], ["contracts"]],
    ["retirement", [{ key: "retirement-report", level: "read" }], ["retirement"]],
    ["discipline", [{ key: "disciplinary-actions-report", level: "read" }], ["discipline"]],
    ["leave", [{ key: "leave-requests", level: "read" }], ["leave"]],
    ["legacy_dashboard", [{ key: "dashboard", level: "read" }], []],
  ];
  const dashboards = [];
  for (const [name, grants, sections] of dashboardCases) {
    const row = await createHrd("qa_dash_" + name, grants);
    const session = await cookieFor(row.id);
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = expect(await req("/api/dashboard/summary", session), 200);
      assert.deepEqual(result.sections, sections);
      assert.equal(Object.hasOwn(result, "birthdaySummary"), sections.includes("employees"));
      assert.equal(Object.hasOwn(result, "employeeSummary"), sections.includes("employees"));
      assert.equal(Object.hasOwn(result, "retirementSummary"), sections.includes("retirement"));
      assert.equal(Object.hasOwn(result, "recentDiscipline"), sections.includes("discipline"));
      if (!sections.includes("leave"))
        assert.equal(
          result.metrics.some((metric) => metric.key === "currentLeave"),
          false,
        );
      if (!sections.includes("employees"))
        assert.equal(Object.hasOwn(result.charts, "growth"), false);
      if (!sections.includes("contracts"))
        assert.equal(Object.hasOwn(result.charts, "contracts"), false);
      if (!sections.includes("employees"))
        assert.ok(
          (result.attentionItems || []).every(
            (item) => item.type !== "assignment" && item.canOpenEmployee === false,
          ),
        );
    }
    expect(await req(`/api/dashboard/summary?organizationId=${other.id}`, session), 403);
    dashboards.push({ row, session });
  }
  const dataCached = expect(await req("/api/dashboard/summary", dashboards[0].session), 200);
  const leaveCached = expect(await req("/api/dashboard/summary", dashboards[4].session), 200);
  assert.ok(dataCached.employeeSummary);
  assert.equal(Object.hasOwn(leaveCached, "employeeSummary"), false);
  const fullDashboard = expect(
    await req(`/api/dashboard/summary?organizationId=${org.id}`, superadmin.cookie),
    200,
  );
  assert.equal(fullDashboard.metrics.length, 6);
  assert.ok(fullDashboard.employeeSummary && fullDashboard.birthdaySummary);
  const platformDashboard = expect(await req("/api/dashboard/summary", superadmin.cookie), 200);
  assert.equal(platformDashboard.scope, "platform");
  const leader = expect(
    await req("/api/access/accounts", hrd.cookie, "POST", {
      organizationId: org.id,
      username: "qa_dash_leader",
      roleCode: "leader",
      password,
      confirmPassword: password,
    }),
    201,
  );
  const leaderCookie =
    "sitou_session=" +
    (await createSessionToken({
      userId: leader.id,
      roleCode: "leader",
      organizationId: org.id,
      credentialVersion: 1,
      expiresAt: Date.now() + 600000,
    }));
  const leaderDashboard = expect(await req("/api/dashboard/summary", leaderCookie), 200);
  assert.equal(leaderDashboard.metrics.length, 6);
  assert.ok(leaderDashboard.employeeSummary);
  expect(
    await req(
      `/api/access/accounts/${dashboards[0].row.id}`,
      hrd.cookie,
      "PATCH",
      updateInput(dashboards[0].row, { ...limitedScope, hrisMenuAccess: [] }),
    ),
    200,
  );
  assert.deepEqual(
    expect(await req("/api/dashboard/summary", dashboards[0].session), 200).sections,
    [],
  );
  limited = expect(
    await req(
      `/api/access/accounts/${limited.id}`,
      hrd.cookie,
      "PATCH",
      updateInput(limited, { ...limitedScope, hrisMenuAccess: [] }),
    ),
    200,
  );
  expect(await req("/api/positions", cookie), 403);
  expect(
    await req(
      `/api/access/accounts/${primary.id}`,
      superadmin.cookie,
      "PATCH",
      updateInput(primary, { isActive: false }),
    ),
    409,
  );
  assert.equal(
    (await db.query("SELECT is_active FROM users WHERE id=$1", [primary.id])).rows[0].is_active,
    true,
  );
  const profileId = await employeeProfile("HRISPRIMARY");
  primary = expect(
    await req(
      `/api/access/accounts/${primary.id}`,
      superadmin.cookie,
      "PATCH",
      updateInput(primary, { employeeId: profileId }),
    ),
    200,
  );
  const profile = expect(
    await req(`/api/employees/${profileId}?organizationId=${org.id}`, superadmin.cookie),
    200,
  );
  for (const status of ["terminated", "retired", "deceased"])
    expect(
      await req(`/api/employees/${profileId}`, superadmin.cookie, "DELETE", {
        organizationId: org.id,
        status,
        terminationDate: new Date().toISOString().slice(0, 10),
        reason: "Uji guard admin HRD penuh",
        version: profile.updated_at,
      }),
      409,
    );
  assert.equal(
    (await db.query("SELECT employment_status FROM employees WHERE id=$1", [profileId])).rows[0]
      .employment_status,
    "active",
  );
  const successor = await createHrd("qa_hris_successor", []);
  expect(
    await req(
      `/api/access/accounts/${successor.id}`,
      hrd.cookie,
      "PATCH",
      updateInput(successor, { isHrisAdmin: true, hrisPolicyVersion: 1 }),
    ),
    403,
  );
  expect(
    await req(
      `/api/access/accounts/${successor.id}`,
      superadmin.cookie,
      "PATCH",
      updateInput(successor, { isHrisAdmin: true, hrisPolicyVersion: 0 }),
    ),
    409,
  );
  expect(
    await req(
      `/api/access/accounts/${successor.id}`,
      superadmin.cookie,
      "PATCH",
      updateInput(successor, { isHrisAdmin: true, hrisPolicyVersion: 1 }),
    ),
    200,
  );
  assert.equal(expect(await req("/api/access/me", hrd.cookie), 200).hris.fullAdmin, false);
  expect(await req("/api/access/accounts", hrd.cookie), 403);
  assert.equal(
    (
      await db.query(
        "SELECT count(*)::int total FROM organization_hris_access_policies WHERE organization_id=$1 AND enabled",
        [org.id],
      )
    ).rows[0].total,
    1,
  );
  assert.ok(
    (
      await db.query(
        "SELECT 1 FROM audit_logs WHERE organization_id=$1 AND action='hris.admin.assign'",
        [org.id],
      )
    ).rowCount >= 2,
  );
  const first = expect(
    await req("/api/access/accounts", superadmin.cookie, "POST", {
      organizationId: other.id,
      username: "qa_first_primary",
      roleCode: "hrd",
      password,
      confirmPassword: password,
    }),
    201,
  );
  assert.equal(first.hrisAccess.fullAdmin, true);
  console.log(
    "PASS HRIS: delegasi, read/manage, isolasi, rollback/version, pencabutan session, transfer admin, guard lifecycle, UI 320–1920.",
  );
}
