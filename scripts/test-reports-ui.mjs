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
  let exportRequests = 0;
  let reportRequests = 0;
  let photoFails = false;
  await page.route("**/api/uploads/990001?*", (route) =>
    route.fulfill(
      photoFails
        ? { status: 404, body: "" }
        : {
            contentType: "image/png",
            body: Buffer.from(
              "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6n8AAAAASUVORK5CYII=",
              "base64",
            ),
          },
    ),
  );
  page.on("pageerror", (error) => errors.push(error.message));
  // Hanya isi laporan dimock dengan data sintetis untuk menguji nama panjang dan card berisi data.
  await page.route("**/api/reports/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/export")) {
      exportRequests++;
      assert.equal(url.searchParams.has("cursor"), false);
      await route.fulfill({
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers: { "Content-Disposition": 'attachment; filename="laporan-uji.xlsx"' },
        body: Buffer.from("uji"),
      });
      return;
    }
    const retirement = url.pathname.endsWith("retirements");
    reportRequests++;
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
              organization_id: String(actor.organization_id),
              profile_photo_file_id: "990001",
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
  const referencePage = await context.newPage();
  await referencePage.goto(base + "/employees");
  await referencePage.getByRole("heading", { name: "Daftar data pegawai", exact: true }).waitFor();
  const spacing = (p, title) =>
    p.getByRole("heading", { name: title, exact: true }).evaluate((heading) => {
      const panel = heading.closest("section");
      const box = panel.getBoundingClientRect();
      const main = getComputedStyle(document.querySelector("main"));
      const header = getComputedStyle(heading.parentElement.parentElement);
      return {
        left: box.left,
        width: box.width,
        padding: main.padding,
        headerPadding: header.padding,
      };
    });
  for (const kind of ["retirements", "expiring-contracts"]) {
    await page.goto(`${base}/reports/${kind}`);
    await page
      .getByText("Pegawai Sintetis Dengan Nama Panjang Untuk Pemeriksaan Tampilan", { exact: true })
      .waitFor();
    for (const width of [320, 375, 768, 1024, 1366, 1920]) {
      await page.setViewportSize({ width, height: 1000 });
      await referencePage.setViewportSize({ width, height: 1000 });
      await page.waitForTimeout(200);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      assert.equal(overflow, false, `${kind}: halaman overflow pada ${width}px`);
      assert.deepEqual(
        await spacing(page, "Hasil laporan"),
        await spacing(referencePage, "Daftar data pegawai"),
        `Padding ${kind} harus sama dengan Data Pegawai pada ${width}px`,
      );
      const exportButton = page.getByRole("button", { name: "Export", exact: true });
      assert.equal((await exportButton.innerText()).trim(), width < 1024 ? "" : "Export");
      await page.screenshot({ path: `.next/report-qa/${kind}-${width}.png`, fullPage: true });
    }
    await page.getByRole("button", { name: "Export", exact: true }).click();
    const beforePdf = exportRequests;
    await page.getByRole("menuitem", { name: "Unduh PDF" }).click();
    await page.getByText("Segera hadir. Ekspor PDF belum tersedia.", { exact: true }).waitFor();
    assert.equal(exportRequests, beforePdf);
    await page.getByRole("button", { name: "Export", exact: true }).click();
    const download = page.waitForEvent("download");
    await page.getByRole("menuitem", { name: "Unduh Excel" }).click();
    await download;
    assert.equal(exportRequests, beforePdf + 1);
    await page.getByRole("combobox", { name: "Periode laporan", exact: true }).click();
    await page.getByText("Rentang tanggal sendiri", { exact: true }).last().click();
    await page
      .getByText("Pilih tanggal awal dan akhir untuk menampilkan laporan.", { exact: true })
      .waitFor();
    const blockedRequests = reportRequests;
    await page.waitForTimeout(600);
    assert.equal(reportRequests, blockedRequests);
    assert.equal(
      await page.getByRole("button", { name: "Export", exact: true }).isDisabled(),
      true,
    );
    for (const suffix of [
      "",
      "&startDate=2026-09-01",
      "&startDate=2026-02-31&endDate=2026-09-30",
      "&startDate=2026-10-01&endDate=2026-09-01",
    ]) {
      await page.goto(`${base}/reports/${kind}?period=custom${suffix}`);
      await page
        .getByRole("status")
        .filter({ hasText: /tanggal/ })
        .waitFor();
      await page.waitForTimeout(600);
      assert.equal(reportRequests, blockedRequests);
      assert.equal(await page.getByText("Terjadi kendala", { exact: true }).count(), 0);
    }
    await page.goto(
      `${base}/reports/${kind}?period=custom&startDate=2026-09-01&endDate=2026-09-30`,
    );
    await page.getByRole("button", { name: /^Perbesar pas foto/ }).waitFor();
    assert.ok(reportRequests > blockedRequests);
    const photoButton = page.getByRole("button", { name: /^Perbesar pas foto/ });
    await photoButton.focus();
    await page.keyboard.press("Enter");
    await page.getByRole("heading", { name: "Pas foto pegawai", exact: true }).waitFor();
    await page.keyboard.press("Escape");
    await page
      .getByRole("heading", { name: "Pas foto pegawai", exact: true })
      .waitFor({ state: "hidden" });
    await page.getByRole("combobox", { name: "Kelompok laporan", exact: true }).click();
    await page.getByText(retirementLabel(kind), { exact: true }).last().click();
    await page.waitForURL(/group=overdue/);
    assert.match(page.url(), /period=none/);
    await page.getByRole("button", { name: "Atur ulang", exact: true }).click();
    await page.waitForURL((url) => !url.searchParams.has("group"));
    photoFails = true;
    await page.reload();
    await page
      .getByLabel("Inisial Pegawai Sintetis Dengan Nama Panjang Untuk Pemeriksaan Tampilan", {
        exact: true,
      })
      .waitFor();
    photoFails = false;
    await page.getByRole("button", { name: /^Lihat detail Pegawai Sintetis/ }).click();
    await page.waitForURL(
      (url) =>
        url.pathname === "/employees/1" &&
        url.searchParams.get("tab") === (kind === "retirements" ? "summary" : "contracts"),
    );
    console.log(
      `PASS UI ${kind}: 320–1920px, data panjang, filter sudah lewat, reset, tanpa overflow halaman.`,
    );
  }
  await referencePage.close();
  const syntheticRow = {
    id: "1",
    employee_id: "1",
    organization_id: String(actor.organization_id),
    full_name: "Pegawai Uji Pensiun",
    employee_no: "000001",
    age: 58,
    location_name: "Lokasi Pengujian",
    position_name: "Petugas Pengujian",
    due_date: "2026-10-01",
    days_remaining: 20,
    deadline: "20 hari lagi",
  };
  await page.route("**/api/dashboard/summary?*", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          scope: "organization",
          generatedAt: "2026-09-11T00:00:00Z",
          metrics: [
            "activeEmployees",
            "unassignedEmployees",
            "expiringContracts",
            "incompleteEmployees",
            "activeDiscipline",
            "onLeave",
          ].map((key) => ({ key, label: key, value: 1, tone: "info", href: "/employees" })),
          charts: Object.fromEntries(
            ["locations", "units"].map((key) => [
              key,
              {
                categories: Array.from({ length: 20 }, (_, i) => `Kategori pengujian ${i + 1}`),
                series: [{ name: "Pegawai", data: Array.from({ length: 20 }, (_, i) => 20 - i) }],
              },
            ]),
          ),
          activities: [],
          recentDiscipline: [
            {
              type: "discipline",
              id: "1",
              caseId: "2",
              title: "Pegawai Uji Disiplin",
              description: "Pelanggaran ringan - 01 Sep 2026",
            },
          ],
          attentionItems: [
            {
              type: "contract",
              id: "1",
              title: "Pegawai Uji Kontrak",
              description: "Kontrak segera berakhir",
              priority: 1,
            },
          ],
          retirementSummary: {
            asOf: "2026-09-11",
            upcoming: {
              value: 6,
              rows: Array.from({ length: 5 }, (_, i) => ({
                ...syntheticRow,
                id: String(i + 1),
                employee_id: String(i + 1),
                full_name: "Pegawai Uji Pensiun " + (i + 1),
              })),
              href: "/reports/retirements?group=upcoming&period=12m",
            },
            overdue: {
              value: 1,
              rows: [
                {
                  ...syntheticRow,
                  full_name: "Pegawai Uji Lewat Usia",
                  days_remaining: -20,
                  deadline: "Lewat 20 hari",
                },
              ],
              href: "/reports/retirements?group=overdue&period=none",
            },
          },
        },
      },
    }),
  );
  await page.goto(base + "/dashboard");
  await page.getByText("Pegawai Uji Pensiun 1", { exact: true }).waitFor();
  assert.equal(await page.locator('section[aria-label="Indikator utama"] > *').count(), 6);
  assert.equal(await page.getByLabel("Rentang tanggal dashboard").count(), 0);
  const metrics = page.locator('section[aria-label="Indikator utama"]');
  assert.equal(await metrics.locator("a, button, [role=button]").count(), 0);
  for (const card of await metrics.locator(":scope > *").all()) {
    await card.hover();
    await page.waitForTimeout(250);
    assert.notEqual(await card.evaluate((el) => getComputedStyle(el).transform), "none");
    const before = page.url();
    await card.click();
    assert.equal(page.url(), before);
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await metrics.locator(":scope > *").first().hover();
  assert.equal(
    await metrics
      .locator(":scope > *")
      .first()
      .evaluate((el) => getComputedStyle(el).transform),
    "none",
  );
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.getByRole("heading", { name: "Kasus disiplin terbaru" }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Export", exact: true }).count(), 0);
  for (const width of [320, 375, 768, 1024, 1366, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.waitForTimeout(200);
    const chartRegions = page.getByRole("region", { name: "Grafik batang yang dapat digulir" });
    assert.equal(await chartRegions.count(), 2);
    for (const chartRegion of await chartRegions.all()) {
      assert.equal(await chartRegion.evaluate((el) => getComputedStyle(el).scrollbarWidth), "none");
      await chartRegion.focus();
      await page.keyboard.press("End");
      await page.waitForTimeout(250);
      assert.ok(await chartRegion.evaluate((el) => el.scrollTop > 0));
      await chartRegion.evaluate((el) => {
        el.scrollTop = 0;
      });
    }
    const region = page.getByRole("region", { name: "Daftar prioritas pensiun", exact: true });
    assert.equal(await region.evaluate((el) => getComputedStyle(el).scrollbarWidth), "none");
    await region.focus();
    await page.keyboard.press("End");
    await page.waitForTimeout(200);
    assert.ok(await region.evaluate((el) => el.scrollTop > 0));
    await region.evaluate((el) => {
      el.scrollTop = 0;
    });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
      false,
    );
    await page.screenshot({ path: `.next/report-qa/dashboard-${width}.png`, fullPage: true });
    await page
      .getByRole("heading", { name: "Proyeksi pensiun", exact: true })
      .locator("xpath=ancestor::section[1]")
      .screenshot({ path: `.next/report-qa/pension-panel-${width}.png` });
  }
  await page.getByText("Lewat usia pensiun", { exact: true }).click();
  await page.getByText("Pegawai Uji Lewat Usia", { exact: true }).waitFor();
  await page
    .getByRole("button", { name: "Lihat pegawai Pegawai Uji Lewat Usia", exact: true })
    .click();
  await page.waitForURL(/employees\/1.*tab=summary/);
  await page.goto(base + "/dashboard");
  await page
    .getByRole("button", { name: "Lihat kontrak Pegawai Uji Kontrak", exact: true })
    .click();
  await page.waitForURL(/employees\/1.*tab=contracts/);
  console.log(
    "PASS dashboard: enam indikator, lima prioritas, pergantian kelompok, tautan pegawai/kontrak, 320–1920px.",
  );
  assert.deepEqual(errors, []);
} finally {
  await browser?.close();
  await pool.end();
}

/** Label pilihan mengikuti jenis laporan yang diuji. */
function retirementLabel(kind) {
  return kind === "retirements" ? "Sudah mencapai usia pensiun" : "Sudah lewat tanggal akhir";
}
