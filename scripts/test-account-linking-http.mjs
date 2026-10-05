import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import dotenv from "dotenv";
import pg from "pg";
import { createSessionToken, SESSION_COOKIE_NAME } from "../lib/auth/session.js";

dotenv.config({ path: ".env.development", quiet: true });
if (!process.env.PGDATABASE || /prod/i.test(process.env.PGDATABASE))
  throw new Error("Uji hanya boleh memakai database development.");
const base = process.env.SITOU_TEST_BASE_URL || "http://localhost:3000";
const db = new pg.Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
});
const prefix = `qa_link_${randomUUID().slice(0, 8)}`;
const employeeIds = [];
const accountIds = [];
const cookie = async (actor) =>
  `${SESSION_COOKIE_NAME}=${await createSessionToken({
    userId: String(actor.id),
    roleCode: actor.role_code,
    organizationId: actor.organization_id ? String(actor.organization_id) : null,
    credentialVersion: Number(actor.credential_version || 1),
    expiresAt: Date.now() + 600000,
  })}`;
async function request(path, auth, method = "GET", body) {
  const response = await fetch(`${base}/api/access/accounts${path}`, {
    method,
    headers: {
      Cookie: auth,
      Origin: base,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, ...(await response.json()) };
}
function expect(result, status) {
  assert.equal(result.status, status, result.message);
  return result.data;
}
try {
  const actors = (
    await db.query(`SELECT u.id,u.credential_version,r.code AS role_code,m.organization_id
    FROM users u JOIN user_organization_roles m ON m.user_id=u.id JOIN roles r ON r.id=m.role_id
    WHERE u.is_active AND m.active_from<=now() AND (m.active_until IS NULL OR m.active_until>now())
      AND (r.code='superadmin' OR (r.code='hrd' AND m.location_scope_mode='all'))`)
  ).rows;
  const admin = actors.find((a) => a.role_code === "superadmin");
  const hrd = actors.find((a) => a.role_code === "hrd");
  assert.ok(admin && hrd, "Memerlukan Superadmin dan HRD development aktif.");
  const adminCookie = await cookie(admin),
    hrdCookie = await cookie(hrd);
  const org = String(hrd.organization_id);
  const assignment = (
    await db.query(
      `SELECT location_id,organization_unit_id,position_id
    FROM employee_assignments WHERE organization_id=$1 AND assignment_type='primary'
      AND effective_from<=current_date AND (effective_until IS NULL OR effective_until>=current_date) LIMIT 1`,
      [org],
    )
  ).rows[0];
  assert.ok(assignment, "Memerlukan penempatan development aktif.");
  for (let i = 0; i < 5; i++) {
    const e = (
      await db.query(
        `INSERT INTO employees(organization_id,employee_no,full_name,national_id,joined_date,employment_status)
      VALUES($1,$2,$3,$4,'2021-01-01','active') RETURNING id::text`,
        [org, `${prefix}_${i}`, `QA profil ${prefix} ${i}`, `${Date.now()}${i}00`],
      )
    ).rows[0];
    employeeIds.push(e.id);
    await db.query(
      `INSERT INTO employee_assignments(organization_id,employee_id,location_id,organization_unit_id,position_id,effective_from)
      VALUES($1,$2,$3,$4,$5,'2021-01-01')`,
      [org, e.id, assignment.location_id, assignment.organization_unit_id, assignment.position_id],
    );
  }
  const input = (name, employeeId, roleCode = "employee") => ({
    organizationId: org,
    employeeId,
    username: `${prefix}_${name}`,
    roleCode,
    locationScopeMode: "all",
    locationIds: [],
    isActive: true,
  });
  async function create(name, employeeId, roleCode = "employee", auth = adminCookie) {
    const result = await request("", auth, "POST", {
      ...input(name, employeeId, roleCode),
      password: "QaLink123!",
      confirmPassword: "QaLink123!",
    });
    if (result.data?.id) accountIds.push(result.data.id);
    return result;
  }
  const target = expect(await create("target", employeeIds[0], "hrd"), 201);
  const staleHrdCookie = await cookie({ id: target.id, role_code: "hrd", organization_id: org });
  expect(
    await request(`/${target.id}`, adminCookie, "PATCH", {
      ...input("target", employeeIds[0]),
      version: target.updated_at,
    }),
    200,
  );
  assert.equal((await request("", staleHrdCookie)).status, 401, "Session HRD lama harus ditolak.");
  const list = expect(await request(`?search=${prefix}&roleCode=hrd`, hrdCookie), 200);
  assert.ok(
    list.some((a) => a.id === target.id && a.role_code === "employee"),
    "Hasil perubahan role harus muncul pada daftar HRD.",
  );
  const leader = expect(await create("leader", employeeIds[1], "leader"), 201);
  const inactive = expect(await create("inactive", employeeIds[2]), 201);
  expect(
    await request(`/${inactive.id}`, adminCookie, "PATCH", {
      ...input("inactive", employeeIds[2]),
      isActive: false,
      version: inactive.updated_at,
    }),
    200,
  );
  for (const auth of [adminCookie, hrdCookie]) {
    const options = expect(await request(`/reference-options?organizationId=${org}`, auth), 200);
    for (const id of employeeIds.slice(0, 3))
      assert.ok(!options.employees.some((e) => e.id === id));
    assert.ok(options.employees.some((e) => e.id === employeeIds[3]));
    const edit = expect(
      await request(`/reference-options?organizationId=${org}&accountId=${target.id}`, auth),
      200,
    );
    assert.ok(edit.employees.some((e) => e.id === employeeIds[0]));
    assert.ok(!edit.employees.some((e) => e.id === employeeIds[1]));
  }
  expect(await request(`/reference-options?accountId=${leader.id}`, hrdCookie), 404);
  const conflict = await create("conflict", employeeIds[0], "employee", hrdCookie);
  expect(conflict, 409);
  assert.ok(conflict.fieldErrors.employeeId);
  const current = expect(await request(`/${target.id}?organizationId=${org}`, adminCookie), 200);
  const editConflict = await request(`/${target.id}`, adminCookie, "PATCH", {
    ...input("target", employeeIds[1]),
    version: current.updated_at,
  });
  expect(editConflict, 409);
  assert.ok(editConflict.fieldErrors.employeeId);
  const race = await Promise.all([
    create("race_a", employeeIds[3]),
    create("race_b", employeeIds[3]),
  ]);
  assert.deepEqual(race.map((r) => r.status).sort(), [201, 409]);
  assert.equal(
    (
      await db.query("SELECT count(*)::int AS n FROM users WHERE username IN ($1,$2)", [
        `${prefix}_race_a`,
        `${prefix}_race_b`,
      ])
    ).rows[0].n,
    1,
  );
  const scoped = expect(await create("scoped", null, "hrd"), 201);
  expect(
    await request(`/${scoped.id}`, adminCookie, "PATCH", {
      ...input("scoped", null, "hrd"),
      locationScopeMode: "selected",
      locationIds: [String(assignment.location_id)],
      version: scoped.updated_at,
    }),
    200,
  );
  const scopedCookie = await cookie({ id: scoped.id, role_code: "hrd", organization_id: org });
  await db.query("DELETE FROM employee_assignments WHERE employee_id=$1", [employeeIds[0]]);
  assert.ok(
    !expect(await request(`?search=${prefix}`, scopedCookie), 200).some((a) => a.id === target.id),
  );
  expect(await request(`/${target.id}`, scopedCookie), 403);
  expect(
    await request(`/${target.id}`, scopedCookie, "PATCH", {
      ...input("target", employeeIds[4]),
      version: current.updated_at,
    }),
    403,
  );
  expect(await request(`/reference-options?accountId=${target.id}`, scopedCookie), 403);
  const other = (await db.query("SELECT id::text FROM organizations WHERE id<>$1 LIMIT 1", [org]))
    .rows[0];
  if (other) expect(await request(`/reference-options?organizationId=${other.id}`, hrdCookie), 403);
  const linked = (
    await db.query("SELECT user_id::text FROM employees WHERE id=$1", [employeeIds[0]])
  ).rows[0];
  assert.equal(linked.user_id, target.id);
  if (process.env.SITOU_TEST_UI === "1") {
    const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || "playwright");
    const browser = await chromium.launch({
      executablePath: process.env.CHROME_PATH,
      headless: true,
    });
    try {
      for (const width of [1366, 375]) {
        const context = await browser.newContext({ viewport: { width, height: 900 } });
        await context.addCookies([
          {
            name: SESSION_COOKIE_NAME,
            value: hrdCookie.slice(SESSION_COOKIE_NAME.length + 1),
            url: base,
          },
        ]);
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await Promise.all([
          page.waitForResponse(
            (response) =>
              new URL(response.url()).pathname === "/api/access/accounts" &&
              response.status() === 200,
          ),
          page.goto(`${base}/access/accounts`),
        ]);
        await page.getByRole("button", { name: /Tambah akun/ }).click();
        const dialog = page.getByRole("dialog");
        await dialog.waitFor({ timeout: 10000 }).catch(async (error) => {
          throw new Error(
            `${error.message}; URL=${page.url()}; errors=${JSON.stringify(errors)}; page=${(await page.locator("body").innerText()).slice(-1800)}`,
          );
        });
        const select = dialog
          .locator(".ant-form-item")
          .filter({ has: page.locator('label[for$="employeeId"]') })
          .locator(".ant-select");
        await page.getByRole("button", { name: "Simpan akun", exact: true }).waitFor();
        await page.waitForFunction(
          () => !document.querySelector('[role="dialog"] .ant-select-loading'),
        );
        await select.click();
        await select.locator("input").fill(prefix);
        const choices = page.locator(
          ".ant-select-dropdown:visible .ant-select-item-option-content",
        );
        await choices.first().waitFor();
        const labels = await choices.allTextContents();
        assert.ok(labels.some((label) => label.includes(`${prefix}_4`)));
        for (let i = 0; i < 4; i++)
          assert.ok(!labels.some((label) => label.includes(`${prefix}_${i}`)));
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
          false,
        );
        assert.deepEqual(errors, []);
        await context.close();
      }
      console.log(
        "UI dropdown HRD lulus pada desktop dan mobile tanpa runtime error atau overflow halaman.",
      );
    } finally {
      await browser.close();
    }
  }
  console.log(
    "Lulus: perubahan role, daftar HRD, dropdown create/edit, akun nonaktif, konflik langsung, race, session lama, scope lokasi dan isolasi organisasi.",
  );
} finally {
  // Semua ID berasal dari fixture ini; tidak menghapus data akun/profil pengguna.
  const discovered = (
    await db.query("SELECT id::text FROM users WHERE username LIKE $1", [`${prefix}%`])
  ).rows.map((a) => a.id);
  const ids = [...new Set([...accountIds, ...discovered])];
  await db.query("DELETE FROM audit_logs WHERE entity_type='user' AND entity_id=ANY($1::text[])", [
    ids,
  ]);
  await db.query("DELETE FROM employee_assignments WHERE employee_id=ANY($1::bigint[])", [
    employeeIds,
  ]);
  await db.query("DELETE FROM employees WHERE id=ANY($1::bigint[])", [employeeIds]);
  await db.query(
    "DELETE FROM user_location_scopes WHERE user_organization_role_id IN (SELECT id FROM user_organization_roles WHERE user_id=ANY($1::bigint[]))",
    [ids],
  );
  await db.query("DELETE FROM user_organization_roles WHERE user_id=ANY($1::bigint[])", [ids]);
  await db.query("DELETE FROM users WHERE id=ANY($1::bigint[])", [ids]);
  await db.end();
}
