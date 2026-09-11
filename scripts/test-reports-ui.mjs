import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import dotenv from "dotenv";
import pg from "pg";
import { createSessionToken, SESSION_COOKIE_NAME } from "../lib/auth/session.js";
dotenv.config({ path: ".env.development", quiet: true });
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || "playwright");
const base = process.env.SITOU_TEST_BASE_URL || "http://localhost:3000";
const pool = new pg.Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
});
let browser;
try {
  const actor = (
    await pool.query(`SELECT u.id,u.credential_version,r.code AS role_code,m.organization_id FROM users u
    JOIN user_organization_roles m ON m.user_id=u.id JOIN roles r ON r.id=m.role_id WHERE r.code='hrd' AND u.is_active
    AND m.active_from<=now() AND (m.active_until IS NULL OR m.active_until>now()) ORDER BY u.id LIMIT 1`)
  ).rows[0];
  assert.ok(actor, "Akun HRD lokal diperlukan untuk pengujian halaman.");
  const token = await createSessionToken({
    userId: String(actor.id),
    roleCode: actor.role_code,
    organizationId: String(actor.organization_id),
    credentialVersion: Number(actor.credential_version),
    expiresAt: Date.now() + 600000,
  });
  browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
  });
  const context = await browser.newContext();
  await context.addCookies([{ name: SESSION_COOKIE_NAME, value: token, url: base }]);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  // Hanya isi laporan dimock dengan data sintetis untuk menguji nama panjang dan card berisi data.
  await page.route("**/api/reports/*", async (route) => {
    const url = new URL(route.request().url());
    const retirement = url.pathname.endsWith("retirements");
    await route.fulfill({
      json: {
        success: true,
        data: {
          organization: { name: "Organisasi Uji", id: String(actor.organization_id) },
          asOf: "2026-09-11",
          generatedAt: "2026-09-11T00:00:00Z",
          filters: {
            group: url.searchParams.get("group") || "upcoming",
            startDate: "2026-09-11",
            endDate: "2027-09-11",
          },
          total: 1,
          employeeCount: 1,
          nextCursor: null,
          rows: [
            {
              id: "1",
              employee_id: "1",
              full_name: "Pegawai Sintetis Dengan Nama Panjang Untuk Pemeriksaan Tampilan",
              employee_no: "000001",
              location_name: "Lokasi Pemeriksaan",
              unit_name: "Divisi Pengujian Tampilan dan Tata Letak",
              position_name: "Pelaksana",
              employment_type_name: "Jenis Kepegawaian Pengujian",
              birth_date: "1969-02-01",
              age: 57,
              joined_date: "2020-01-01",
              tenure: "6 tahun 8 bulan 10 hari",
              due_date: "2027-02-01",
              deadline: "143 hari lagi",
              days_remaining: 143,
              contract_no: retirement ? null : "001/QA",
              start_date: "2026-01-01",
              successor_start_date: null,
            },
          ],
        },
      },
    });
  });
  await mkdir(".next/report-qa", { recursive: true });
  for (const kind of ["retirements", "expiring-contracts"]) {
    await page.goto(`${base}/reports/${kind}`);
    await page
      .getByText("Pegawai Sintetis Dengan Nama Panjang Untuk Pemeriksaan Tampilan", { exact: true })
      .waitFor();
    for (const width of [320, 375, 768, 1024, 1366, 1920]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.waitForTimeout(200);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      assert.equal(overflow, false, `${kind}: halaman overflow pada ${width}px`);
      await page.screenshot({ path: `.next/report-qa/${kind}-${width}.png`, fullPage: true });
    }
    await page.getByRole("combobox", { name: "Kelompok laporan", exact: true }).click();
    await page.getByText(retirementLabel(kind), { exact: true }).last().click();
    await page.waitForURL(/group=overdue/);
    assert.match(page.url(), /period=none/);
    await page.getByRole("button", { name: "Atur ulang", exact: true }).click();
    await page.waitForURL((url) => !url.searchParams.has("group"));
    console.log(
      `PASS UI ${kind}: 320–1920px, data panjang, filter sudah lewat, reset, tanpa overflow halaman.`,
    );
  }
  assert.deepEqual(errors, []);
} finally {
  await browser?.close();
  await pool.end();
}

/** Label pilihan mengikuti jenis laporan yang diuji. */
function retirementLabel(kind) {
  return kind === "retirements" ? "Sudah mencapai usia pensiun" : "Sudah lewat tanggal akhir";
}
