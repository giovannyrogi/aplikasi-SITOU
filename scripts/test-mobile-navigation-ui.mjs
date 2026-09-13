import assert from "node:assert/strict";
import { createRequire } from "node:module";
import dotenv from "dotenv";
import pg from "pg";
import { createSessionToken, SESSION_COOKIE_NAME } from "../lib/auth/session.js";

dotenv.config({ path: ".env.development", quiet: true });
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || "playwright");
const base = process.env.SITOU_TEST_BASE_URL || "http://localhost:3000";
const pool = new pg.Pool();
let browser;
try {
  const {
    rows: [actor],
  } = await pool.query(`SELECT u.id,u.credential_version,m.organization_id
    FROM users u JOIN user_organization_roles m ON m.user_id=u.id JOIN roles r ON r.id=m.role_id
    WHERE r.code='hrd' AND u.is_active AND m.active_from<=now()
    AND (m.active_until IS NULL OR m.active_until>now()) ORDER BY u.id LIMIT 1`);
  assert.ok(actor, "Pengujian memerlukan akun HRD lokal.");
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
  const page = await context.newPage();
  await page.setViewportSize({ width: 375, height: 600 });
  await page.goto(base + "/reports/retirements");
  for (const width of [320, 375, 768]) {
    await page.setViewportSize({ width, height: 600 });
    await page.getByRole("button", { name: "Buka menu navigasi", exact: true }).click();
    const drawer = page.locator(".MuiDrawer-paper");
    await drawer.waitFor({ state: "visible" });
    assert.match(await drawer.evaluate((el) => getComputedStyle(el).backgroundColor), /^rgb\(/);
    const navigation = drawer.getByRole("navigation", { name: "Navigasi utama", exact: true });
    await drawer.getByRole("button", { name: "Data Master", exact: true }).click();
    await page.waitForTimeout(350);
    assert.equal(await navigation.evaluate((el) => getComputedStyle(el).scrollbarWidth), "none");
    assert.ok(await navigation.evaluate((el) => el.scrollHeight > el.clientHeight));
    await navigation.hover();
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(250);
    assert.ok(await navigation.evaluate((el) => el.scrollTop > 0));
    await navigation.evaluate((el) => {
      el.scrollTop = 0;
    });
    await page.screenshot({ path: `.next/navigation-qa/mobile-${width}.png` });
    await drawer.getByRole("button", { name: "Data Master", exact: true }).click();
    await page.keyboard.press("Escape");
    await drawer.waitFor({ state: "hidden" });
  }
  for (const width of [375, 1366]) {
    await page.setViewportSize({ width, height: 900 });
    const button = page.getByRole("button", { name: "Export", exact: true });
    await button.locator('[aria-label="download"]').waitFor();
    await button.click();
    await page.getByRole("menuitem", { name: "Unduh PDF" }).click();
    await page.getByText("Segera hadir. Ekspor PDF belum tersedia.", { exact: true }).waitFor();
  }
  await page.goto(base + "/employees");
  await page.getByRole("combobox", { name: "Jenis Kepegawaian", exact: true }).click();
  const filtered = page.waitForResponse(
    (response) =>
      response.url().includes("/api/employees?") &&
      response.url().includes("without_active_contract"),
  );
  await page.getByText("Tanpa kontrak aktif", { exact: true }).last().click();
  assert.equal((await filtered).status(), 200);
  await page.getByRole("combobox", { name: "Kelengkapan data", exact: true }).click();
  const incompleteResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/employees?") &&
      response.url().includes("completeness=incomplete"),
  );
  await page.getByText("Belum lengkap", { exact: true }).last().click();
  assert.equal((await incompleteResponse).status(), 200);
  await page.getByText("Data pegawai belum lengkap", { exact: true }).waitFor();
  await page.waitForTimeout(600);
  for (const width of [320, 375, 768, 1024, 1366, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.waitForTimeout(200);
    const columns = await page
      .getByRole("combobox", { name: "Jenis Kepegawaian", exact: true })
      .evaluate((el) => {
        while (el && getComputedStyle(el).display !== "grid") el = el.parentElement;
        return getComputedStyle(el).gridTemplateColumns.split(" ").length;
      });
    assert.equal(columns, width >= 1200 ? 4 : width >= 900 ? 3 : width >= 600 ? 2 : 1);
    await page.screenshot({ path: `.next/navigation-qa/page-${width}.png` });
    const overflow = await page.evaluate(() => ({
      width: innerWidth,
      scroll: document.documentElement.scrollWidth,
      elements: [...document.querySelectorAll("body *")]
        .filter(
          (el) =>
            el.getBoundingClientRect().right > innerWidth + 1 &&
            getComputedStyle(el).position === "absolute",
        )
        .map((el) => ({
          tag: el.tagName,
          cls: el.className,
          right: el.getBoundingClientRect().right,
        }))
        .slice(0, 10),
    }));
    assert.ok(overflow.scroll <= width + 1, JSON.stringify(overflow));
    await page
      .getByRole("heading", { name: "Filter data pegawai", exact: true })
      .locator("xpath=ancestor::section[1]")
      .screenshot({ path: `.next/navigation-qa/filters-${width}.png` });
  }
  await page.getByRole("button", { name: "Atur ulang", exact: true }).click();
  await page.getByText("Data pegawai belum lengkap", { exact: true }).waitFor({ state: "hidden" });
  await page
    .locator(".ant-select-selection-item")
    .filter({ hasText: "Tanpa kontrak aktif" })
    .waitFor({ state: "hidden" });
  console.log(
    "PASS drawer solid, scroll, Export, filter tanpa kontrak aktif dan grid responsif 320-1920px.",
  );
} finally {
  await browser?.close();
  await pool.end();
}
