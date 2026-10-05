import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { resolvePrivateObjectPath } from "../lib/files/localLifecycle.mjs";
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
let photoId = null,
  photoPath = null;
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
  const image = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jT9sAAAAASUVORK5CYII=",
    "base64",
  );
  const objectKey = `org_${reference.organization_id}/pegawai/employee_${employeeId}/pas_foto/2026/${randomUUID()}.png`;
  photoPath = resolvePrivateObjectPath(objectKey);
  await mkdir(path.dirname(photoPath), { recursive: true });
  await writeFile(photoPath, image);
  photoId = (
    await db.query(
      `INSERT INTO stored_files(organization_id,employee_id,object_key,original_name,mime_type,size_bytes,sha256,category,malware_scan_status)
     VALUES($1,$2,$3,'pas-foto-uji.png','image/png',$4,$5,'employee_photo','clean') RETURNING id`,
      [
        reference.organization_id,
        employeeId,
        objectKey,
        image.length,
        createHash("sha256").update(image).digest("hex"),
      ],
    )
  ).rows[0].id;
  await db.query("UPDATE employees SET profile_photo_file_id=$1 WHERE id=$2", [
    photoId,
    employeeId,
  ]);
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
  const photoResponse = await fetch(`${base}/api/uploads/profile_self`, { headers });
  assert.equal(photoResponse.status, 200);
  assert.equal(photoResponse.headers.get("cache-control"), "private, no-store");
  assert.equal(photoResponse.headers.get("content-type"), "image/png");
  assert.deepEqual(Buffer.from(await photoResponse.arrayBuffer()), image);
  // Target klien diabaikan: endpoint hanya dapat mengembalikan pas foto akun sendiri.
  const injected = await fetch(
    `${base}/api/uploads/profile_self?employeeId=0&organizationId=0&fileId=0`,
    { headers },
  );
  assert.equal(injected.status, 200);
  assert.deepEqual(Buffer.from(await injected.arrayBuffer()), image);
  assert.equal(
    (
      await fetch(`${base}/api/uploads/${photoId}?organizationId=${reference.organization_id}`, {
        headers,
      })
    ).status,
    403,
  );
  assert.equal((await fetch(`${base}/api/uploads/profile_self`)).status, 401);
  await db.query("UPDATE stored_files SET employee_id=NULL WHERE id=$1", [photoId]);
  assert.equal((await fetch(`${base}/api/uploads/profile_self`, { headers })).status, 404);
  await db.query("UPDATE stored_files SET employee_id=$1 WHERE id=$2", [employeeId, photoId]);
  for (const category of ["identity", "education"]) {
    await db.query("UPDATE stored_files SET category=$1 WHERE id=$2", [category, photoId]);
    assert.equal((await fetch(`${base}/api/uploads/profile_self`, { headers })).status, 404);
  }
  await db.query(
    "UPDATE stored_files SET category='employee_photo',malware_scan_status='infected' WHERE id=$1",
    [photoId],
  );
  assert.equal((await fetch(`${base}/api/uploads/profile_self`, { headers })).status, 423);
  await db.query("UPDATE stored_files SET malware_scan_status='clean' WHERE id=$1", [photoId]);
  await db.query("UPDATE employees SET profile_photo_file_id=NULL WHERE id=$1", [employeeId]);
  assert.equal((await fetch(`${base}/api/uploads/profile_self`, { headers })).status, 404);
  await db.query("UPDATE employees SET profile_photo_file_id=$1 WHERE id=$2", [
    photoId,
    employeeId,
  ]);
  assert.equal((await fetch(`${base}/dashboard`, { headers })).status, 200);
  for (const path of ["/", "/login", "/employee-dashboard", "/employees", "/access/accounts"]) {
    const response = await fetch(`${base}${path}`, { headers, redirect: "manual" });
    assert.equal(response.status, 307, path);
    assert.equal(new URL(response.headers.get("location"), base).pathname, "/dashboard", path);
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
        if (width < 600) await page.getByRole("button", { name: "Buka menu navigasi" }).click();
        const avatar = page
          .getByRole("button", { name: "Lihat pas foto profil" })
          .filter({ visible: true });
        await avatar.waitFor();
        await page.waitForFunction(() =>
          [...document.querySelectorAll('img[src*="/api/uploads/profile_self"]')].some(
            (img) => img.complete && img.naturalWidth > 0,
          ),
        );
        await avatar.click();
        await page.getByRole("dialog").waitFor();
        await page.getByRole("button", { name: "Tutup modal", exact: true }).click();
        if (width < 600) await page.keyboard.press("Escape");
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
    "PASS HTTP Pegawai: pas foto sendiri, target klien diabaikan, pemilik file salah/dokumen/file terinfeksi ditolak, API organisasi ditolak, dan session anonim ditolak.",
  );
} finally {
  // Membersihkan hanya fixture sintetis yang dibuat oleh uji ini.
  if (userId) await db.query("DELETE FROM audit_logs WHERE actor_user_id=$1", [userId]);
  if (employeeId) {
    await db.query("UPDATE employees SET profile_photo_file_id=NULL WHERE id=$1", [employeeId]);
    if (photoId) await db.query("DELETE FROM stored_files WHERE id=$1", [photoId]);
    await db.query("DELETE FROM employee_assignments WHERE employee_id=$1", [employeeId]);
    await db.query("DELETE FROM employees WHERE id=$1", [employeeId]);
  }
  if (userId) {
    await db.query("DELETE FROM user_organization_roles WHERE user_id=$1", [userId]);
    await db.query("DELETE FROM users WHERE id=$1", [userId]);
  }
  await db.end();
  if (photoPath) await unlink(photoPath);
}
