import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import dotenv from "dotenv";
import pg from "pg";
import { createSessionToken, SESSION_COOKIE_NAME } from "../lib/auth/session.js";

dotenv.config({ path: ".env.development", quiet: true });
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || "playwright");
const base = process.env.SITOU_TEST_BASE_URL || "http://127.0.0.1:3004";
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base))
  throw new Error("UI test hanya untuk aplikasi lokal.");
const pool = new pg.Pool();
let browser;
let page;
try {
  const {
    rows: [actor],
  } = await pool.query(`SELECT u.id,u.credential_version,m.organization_id
    FROM users u JOIN user_organization_roles m ON m.user_id=u.id JOIN roles r ON r.id=m.role_id
    WHERE r.code='hrd' AND u.is_active AND m.active_from<=now()
      AND (m.active_until IS NULL OR m.active_until>now()) ORDER BY u.id LIMIT 1`);
  assert.ok(actor, "Pengujian memerlukan akun HRD development.");
  const token = await createSessionToken({
    userId: String(actor.id),
    roleCode: "hrd",
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
  page = await context.newPage();
  const runtimeErrors = [];
  page.on("pageerror", (error) => {
    runtimeErrors.push(error.message);
    console.log("UI runtime error:", error.message);
  });
  const employee = {
    id: "99991",
    employee_no: "QA-0001",
    full_name: "Pegawai Uji Dengan Nama Panjang Untuk Memeriksa Kerapian Form Cuti",
  };
  const type = {
    id: "99991",
    name: "Cuti Tahunan",
    unit: "day",
    uses_balance: true,
    requires_attachment: true,
  };
  // Fixture browser dan POST tiruan memastikan tidak ada pencatatan cuti di data development asli.
  await page.route("**/api/employees/options?**", (route) =>
    route.fulfill({ json: { success: true, data: [employee] } }),
  );
  await page.route("**/api/leave-types?**", (route) => {
    if (new URL(route.request().url()).searchParams.get("options") === "true")
      return route.fulfill({ json: { success: true, data: [type] } });
    return route.continue();
  });
  let postCount = 0;
  let remainingBalance = 9;
  await page.route("**/api/employees/99991/leave-summary?**", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          employee,
          year: 2026,
          balances: [
            {
              leave_type_id: type.id,
              balance: remainingBalance,
              transactions: [
                { type: "grant", units: 12 },
                { type: "usage", units: -3 },
              ],
            },
          ],
          requests: [],
        },
      },
    }),
  );
  await page.route("**/api/leave-requests", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    postCount++;
    const body = route.request().postData();
    assert.match(body, /"requestedUnits":2/);
    await new Promise((resolve) => setTimeout(resolve, 300));
    await route.fulfill({
      status: 400,
      json: {
        success: false,
        code: "LEAVE_BEFORE_JOINED",
        message:
          "Tanggal mulai cuti atau izin tidak boleh sebelum TMT bergabung (1 Februari 2021).",
        fieldErrors: {
          startDate:
            "Tanggal mulai cuti atau izin tidak boleh sebelum TMT bergabung (1 Februari 2021).",
        },
      },
    });
  });
  const hydrated = page.waitForResponse((response) =>
    response.url().includes("/api/employees/reference-options"),
  );
  await page.goto(`${base}/leave-requests`);
  await hydrated;
  assert.equal(new URL(page.url()).searchParams.get("startDate"), "2026-01-01");
  assert.equal(new URL(page.url()).searchParams.get("endDate"), "2026-12-31");
  await page.getByRole("button", { name: /Catat cuti\/izin/ }).click();
  const form = page.getByRole("dialog", { name: "Catat cuti atau izin", exact: true });
  await form.getByRole("button", { name: "Simpan", exact: true }).click();
  await form.locator(".ant-form-item-explain-error").first().waitFor();
  await form.locator("#leave-request_employeeId").click();
  await page
    .locator(".ant-select-dropdown:visible .ant-select-item-option")
    .filter({ hasText: "QA-0001" })
    .click();
  await form.locator("#leave-request_leaveTypeId").click();
  await page
    .locator(".ant-select-dropdown:visible .ant-select-item-option")
    .filter({ hasText: "Cuti Tahunan" })
    .click();
  const dates = form.locator(".ant-picker input");
  await dates.nth(0).fill("26 Agt 2026");
  await dates.nth(0).press("Enter");
  await dates.nth(1).fill("29 Agt 2026");
  await dates.nth(1).press("Enter");
  await form.locator("#leave-request_reason").fill("Urusan keluarga untuk pengujian form");
  await form.locator("#leave-request_requestedUnits").fill("2");
  await form.getByText("Perkiraan sisa setelah disimpan: 7 hari.", { exact: true }).waitFor();
  await form.locator("#leave-request_requestedUnits").fill("10");
  assert.equal(await form.getByRole("button", { name: "Simpan", exact: true }).isDisabled(), true);
  await form.locator("#leave-request_requestedUnits").fill("2");
  const file = {
    name: "dokumen-uji.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n%%EOF"),
  };
  await form.locator("input[type=file]").setInputFiles(file);
  await form.getByText(file.name, { exact: true }).waitFor();
  assert.equal(await form.locator("input[type=file]").count(), 1);
  await form.locator("button").filter({ hasText: "Hapus file" }).click();
  await form.getByText("Pilih atau tarik dokumen ke area ini", { exact: true }).waitFor();
  await form.locator("input[type=file]").setInputFiles(file);
  await form.locator("input[type=file]").setInputFiles({ ...file, name: "dokumen-pengganti.pdf" });
  await form.getByText("dokumen-pengganti.pdf", { exact: true }).waitFor();
  await mkdir(".next/leave-qa", { recursive: true });
  for (const width of [320, 375, 768, 1024, 1366, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(
      await form.evaluate((el) => {
        const bounds = el.getBoundingClientRect();
        return bounds.left >= 0 && bounds.right <= window.innerWidth;
      }),
      `Modal melewati layar ${width}`,
    );
    assert.ok(
      await form.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      `Overflow form ${width}`,
    );
    assert.ok(
      await form.evaluate((el) => {
        const panel = [...el.querySelectorAll(".ant-alert")].find((item) =>
          item.textContent.includes("Saldo Cuti Tahunan"),
        );
        const field = el.querySelector("#leave-request_period")?.closest(".ant-form-item");
        if (!panel || !field) return false;
        return field.getBoundingClientRect().top - panel.getBoundingClientRect().bottom >= 15;
      }),
      `Panel saldo terlalu dekat dengan field tanggal ${width}`,
    );
    assert.ok(
      await form.evaluate((el) =>
        [...el.querySelectorAll(".ant-form-item-control-input-content")].every(
          (item) => item.scrollWidth <= item.clientWidth + 1,
        ),
      ),
      `Field keluar dari kolom ${width}`,
    );
    await form.screenshot({ path: `.next/leave-qa/form-${width}.png` });
    await form.getByRole("button", { name: "Simpan", exact: true }).click();
    const confirm = page.getByRole("dialog", { name: "Simpan cuti atau izin?", exact: true });
    await confirm.waitFor();
    assert.match(await confirm.innerText(), /NIP: QA-0001/);
    assert.match(await confirm.innerText(), /berkurang 2 hari/);
    assert.ok(
      await confirm.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      `Overflow konfirmasi ${width}`,
    );
    await confirm.screenshot({ path: `.next/leave-qa/confirm-${width}.png` });
    await page.keyboard.press("Escape");
    await confirm.waitFor({ state: "hidden" });
  }
  await form.getByRole("button", { name: "Simpan", exact: true }).click();
  const confirm = page.getByRole("dialog", { name: "Simpan cuti atau izin?", exact: true });
  await confirm.getByRole("button", { name: "Simpan", exact: true }).click();
  await form.getByText(/Tanggal mulai cuti atau izin tidak boleh sebelum TMT bergabung/).waitFor();
  assert.equal(postCount, 1);
  assert.equal(await form.locator("#leave-request_requestedUnits").inputValue(), "2");
  assert.equal(await form.getByText("dokumen-pengganti.pdf", { exact: true }).count(), 1);
  await page.waitForTimeout(200);
  assert.ok(
    await dates.evaluateAll((inputs) => inputs.includes(document.activeElement)),
    "Error tanggal harus memfokuskan kontrol tanggal.",
  );
  assert.deepEqual(runtimeErrors, []);
  remainingBalance = 0;
  await form.getByRole("button", { name: "Batal", exact: true }).click();
  await page.getByRole("button", { name: /Catat cuti\/izin/ }).click();
  await form.locator("#leave-request_employeeId").click();
  await page
    .locator(".ant-select-dropdown:visible .ant-select-item-option")
    .filter({ hasText: "QA-0001" })
    .click();
  await form.locator("#leave-request_leaveTypeId").click();
  await page
    .locator(".ant-select-dropdown:visible .ant-select-item-option")
    .filter({ hasText: "Cuti Tahunan" })
    .click();
  await form
    .getByText("Saldo sudah habis. Pencatatan jenis cuti ini tidak dapat disimpan.", {
      exact: true,
    })
    .waitFor();
  assert.equal(await form.getByRole("button", { name: "Simpan", exact: true }).isDisabled(), true);
  console.log(
    "PASS UI 320–1920px: validasi, satu lampiran, ganti/hapus, konfirmasi nama/NIP dan saldo, keyboard Escape, field error fokus, isian/file dipertahankan.",
  );
} catch (error) {
  if (page)
    console.log(
      "Tanggal:",
      await page
        .locator("#leave-request_period")
        .evaluate((el) =>
          [...el.closest(".ant-form-item-control-input-content").querySelectorAll("*")].map(
            (item) => ({
              tag: item.tagName,
              cls: item.className,
              width: item.getBoundingClientRect().width,
              scroll: item.scrollWidth,
              left: item.getBoundingClientRect().left,
            }),
          ),
        ),
    );
  if (page)
    console.log(
      "Kontrol melewati kolom:",
      await page
        .locator(".ant-form-item-control-input-content")
        .evaluateAll((items) =>
          items
            .filter((item) => item.scrollWidth > item.clientWidth + 1)
            .map((item) => ({
              label: item.closest(".ant-form-item")?.querySelector("label")?.textContent,
              width: item.clientWidth,
              contentWidth: item.scrollWidth,
            })),
        ),
    );
  await mkdir(".next/leave-qa", { recursive: true });
  await page?.screenshot({ path: ".next/leave-qa/failure.png" });
  if (page)
    console.log("Dialog headings:", await page.locator("[role=dialog] h2").allTextContents());
  throw error;
} finally {
  await browser?.close();
  await pool.end();
}
