import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import dotenv from "dotenv";
import pg from "pg";
import bcrypt from "bcryptjs";

dotenv.config({ path: ".env.development", quiet: true });
assert.ok(
  process.env.PGDATABASE && !/prod/i.test(process.env.PGDATABASE),
  "Gunakan database development.",
);
const db = new pg.Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
});
const base = process.env.SITOU_TEST_BASE_URL || "http://localhost:3000";
const suffix = randomUUID().slice(0, 8);
const username = `qa_employee_dashboard_${suffix}`;
let userId = null,
  employeeId = null;
try {
  // Hanya mengambil ID referensi penempatan; profil pengguna lokal tidak diubah.
  const reference = (
    await db.query(`SELECT a.organization_id,a.location_id,a.organization_unit_id
    FROM employee_assignments a JOIN organizations o ON o.id=a.organization_id AND o.is_active
    JOIN locations l ON l.organization_id=a.organization_id AND l.id=a.location_id AND l.is_active
    JOIN organization_units ou ON ou.organization_id=a.organization_id AND ou.id=a.organization_unit_id AND ou.is_active
    WHERE a.assignment_type='primary' AND a.effective_from<=current_date
      AND (a.effective_until IS NULL OR a.effective_until>=current_date) LIMIT 1`)
  ).rows[0];
  assert.ok(reference, "Memerlukan referensi organisasi development aktif.");
  userId = (
    await db.query("INSERT INTO users(username,password_hash) VALUES($1,$2) RETURNING id", [
      username,
      await bcrypt.hash("QaEmployee123!", 12),
    ])
  ).rows[0].id;
  employeeId = (
    await db.query(
      `INSERT INTO employees(organization_id,employee_no,full_name,national_id,user_id,joined_date,employment_status)
    VALUES($1,$2,'Pegawai Uji Dashboard',$3,$4,'2021-01-01','active') RETURNING id`,
      [reference.organization_id, username, `${Date.now()}000`, userId],
    )
  ).rows[0].id;
  await db.query(
    `INSERT INTO employee_assignments(organization_id,employee_id,location_id,organization_unit_id,effective_from)
    VALUES($1,$2,$3,$4,'2021-01-01')`,
    [reference.organization_id, employeeId, reference.location_id, reference.organization_unit_id],
  );
  await db.query(
    `INSERT INTO user_organization_roles(user_id,organization_id,role_id,location_scope_mode)
    SELECT $1,$2,id,'all' FROM roles WHERE code='employee'`,
    [userId, reference.organization_id],
  );
  const login = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify({ username, password: "QaEmployee123!" }),
  });
  const result = await login.json();
  assert.equal(login.status, 200, result.message);
  assert.equal(result.redirectTo, "/dashboard");
  const cookie = login.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  const headers = { Cookie: cookie, Origin: base };
  assert.equal((await fetch(`${base}/dashboard`, { headers })).status, 200);
  for (const path of ["/", "/login", "/employee-dashboard", "/employees", "/access/accounts"]) {
    const response = await fetch(`${base}${path}`, { headers, redirect: "manual" });
    assert.equal(response.status, 307, path);
    assert.equal(
      new URL(response.headers.get("location"), base).pathname,
      "/dashboard",
      path,
    );
  }
  for (const path of ["/api/dashboard/summary", "/api/employees", "/api/access/accounts"]) {
    assert.equal((await fetch(`${base}${path}`, { headers })).status, 403, path);
  }
  const anonymous = await fetch(`${base}/employee-dashboard`, { redirect: "manual" });
  assert.equal(anonymous.status, 307);
  assert.equal(new URL(anonymous.headers.get("location"), base).pathname, "/login");

  if (process.env.SITOU_TEST_UI === "1") {
    const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || "playwright");
    const browser = await chromium.launch({
      headless: true,
      executablePath: process.env.CHROME_PATH,
    });
    try {
      for (const width of [320, 375, 1366]) {
        const context = await browser.newContext({ viewport: { width, height: 900 } });
        const [name, ...value] = cookie.split("=");
        await context.addCookies([{ name, value: value.join("="), url: base }]);
        const page = await context.newPage();
        const errors = [],
          summaryCalls = [];
        page.on("pageerror", (error) => errors.push(error.message));
        page.on("request", (request) => {
          if (request.url().includes("/api/dashboard/summary")) summaryCalls.push(request.url());
        });
        await page.goto(`${base}/dashboard`);
        await page.locator("main").waitFor();
        assert.equal(new URL(page.url()).pathname, "/dashboard");
        await page.getByRole("heading", { name: "Dashboard monitoring", exact: true }).waitFor();
        assert.equal(await page.locator("main section").count(), 0);
        assert.equal(await page.locator("main button").count(), 0);
        assert.equal(await page.getByText("Operasional stabil", { exact: true }).count(), 0);
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
          false,
        );
        assert.deepEqual(summaryCalls, []);
        assert.deepEqual(errors, []);
        await context.close();
      }
    } finally {
      await browser.close();
    }
    console.log(
      "PASS UI Pegawai: header dashboard terpusat, tanpa request dashboard organisasi atau kartu, tanpa runtime error pada mobile/desktop.",
    );
  }
  console.log(
    "PASS HTTP Pegawai: login, redirect dashboard terpusat, header saja, API organisasi ditolak, dan session anonim ditolak.",
  );
} finally {
  // Membersihkan hanya fixture sintetis yang dibuat oleh uji ini.
  if (userId) await db.query("DELETE FROM audit_logs WHERE actor_user_id=$1", [userId]);
  if (employeeId) {
    await db.query("DELETE FROM employee_assignments WHERE employee_id=$1", [employeeId]);
    await db.query("DELETE FROM employees WHERE id=$1", [employeeId]);
  }
  if (userId) {
    await db.query("DELETE FROM user_organization_roles WHERE user_id=$1", [userId]);
    await db.query("DELETE FROM users WHERE id=$1", [userId]);
  }
  await db.end();
}
