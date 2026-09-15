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
const database = new pg.Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
});
let browser;
try {
  const actors = (
    await database.query(
      `SELECT DISTINCT ON(r.code) u.id,u.credential_version,r.code AS role_code,m.organization_id FROM users u JOIN user_organization_roles m ON m.user_id=u.id JOIN roles r ON r.id=m.role_id WHERE u.is_active AND m.active_from<=now() AND (m.active_until IS NULL OR m.active_until>now()) ORDER BY r.code,u.id`,
    )
  ).rows;
  assert.equal((await fetch(`${base}/api/organization-settings/retirement`)).status, 401);
  let hrdToken;
  let hrd;
  for (const actor of actors) {
    const token = await createSessionToken({
      userId: String(actor.id),
      roleCode: actor.role_code,
      organizationId: actor.organization_id ? String(actor.organization_id) : null,
      credentialVersion: Number(actor.credential_version),
      expiresAt: Date.now() + 600000,
    });
    const headers = {
      Cookie: `${SESSION_COOKIE_NAME}=${token}`,
      Origin: base,
      "Content-Type": "application/json",
    };
    if (actor.role_code === "hrd") {
      hrd = actor;
      hrdToken = token;
    }
    if (actor.role_code === "superadmin") continue;
    const url = `${base}/api/organization-settings/retirement?organizationId=${actor.organization_id}`;
    const response = await fetch(url, { headers });
    if (actor.role_code === "employee") {
      assert.ok([401, 403].includes(response.status));
      continue;
    }
    const body = await response.json();
    assert.equal(response.status, 200, body.message);
    assert.match(response.headers.get("cache-control"), /no-store/);
    assert.equal(
      (
        await fetch(`${base}/api/organization-settings/retirement?organizationId=99999999`, {
          headers,
        })
      ).status,
      403,
    );
    const failed = await fetch(url, {
      method: "PUT",
      headers,
      body: JSON.stringify({ retirementAge: 0, version: 0, reason: "" }),
    });
    assert.equal(failed.status, actor.role_code === "leader" ? 403 : 400);
    if (actor.role_code === "hrd") assert.ok((await failed.json()).fieldErrors.retirementAge);
  }
  assert.ok(hrdToken, "Akun HRD lokal diperlukan.");
  browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
  });
  const context = await browser.newContext();
  await context.addCookies([{ name: SESSION_COOKIE_NAME, value: hrdToken, url: base }]);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (/deprecated/i.test(message.text())) errors.push(message.text());
  });
  let writes = 0;
  let rejectSave = true;
  let policyAge = 58;
  let canManage = true;
  let configured = true;
  // Isian dan penyimpanan UI dimock agar tidak mengubah kebijakan organisasi lokal.
  await page.route("**/api/organization-settings/retirement?*", (route) => {
    if (route.request().method() === "PUT") {
      writes++;
      if (!rejectSave) {
        policyAge = route.request().postDataJSON().retirementAge;
        return route.fulfill({ json: { success: true } });
      }
      return route.fulfill({
        status: 409,
        json: {
          success: false,
          code: "RETIREMENT_POLICY_CONFLICT",
          message: "Kebijakan telah diubah pengguna lain. Muat ulang.",
        },
      });
    }
    return route.fulfill({
      json: {
        success: true,
        data: {
          organization: { id: String(hrd.organization_id), name: "Organisasi Pengujian" },
          canManage,
          history: [],
          policy: configured
            ? {
                retirement_age: policyAge,
                version: 1,
                updated_at: "2026-09-14T00:00:00Z",
                updated_by: "Admin pengujian",
                change_reason: "Kebijakan awal pengujian",
              }
            : null,
        },
      },
    });
  });
  await page.goto(`${base}/organization-settings/retirement`);
  await page
    .getByRole("button", { name: "Ubah usia pensiun", exact: true })
    .waitFor()
    .catch(async (error) => {
      console.log({
        url: page.url(),
        errors,
        buttons: await page.getByRole("button").allTextContents(),
      });
      throw error;
    });
  assert.equal(await page.getByRole("spinbutton").count(), 0);
  await mkdir("artifacts/retirement-policy", { recursive: true });
  for (const width of [320, 375, 768, 1024, 1366, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
      `Overflow ${width}`,
    );
    await page.screenshot({ path: `artifacts/retirement-policy/${width}.png`, fullPage: true });
  }
  await page.getByRole("button", { name: "Ubah usia pensiun", exact: true }).click();
  await page.getByRole("spinbutton").fill("60");
  await page.getByRole("button", { name: "Simpan kebijakan", exact: true }).click();
  await page.getByText("Alasan perubahan minimal 5 karakter.").first().waitFor();
  assert.equal(writes, 0);
  await page
    .getByPlaceholder("Jelaskan dasar atau alasan penetapan usia pensiun")
    .fill("Kebijakan organisasi terbaru");
  await page.getByRole("button", { name: "Simpan kebijakan", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Simpan kebijakan pensiun?", exact: true })
    .getByRole("button", { name: "Simpan kebijakan", exact: true })
    .click();
  await page.getByText("Kebijakan telah diubah pengguna lain. Muat ulang.").waitFor();
  assert.equal(await page.getByRole("spinbutton").inputValue(), "60");
  assert.equal(writes, 1);
  await page.getByRole("button", { name: "Batal", exact: true }).click();
  await page.getByText("Tinggalkan perubahan?", { exact: true }).waitFor();
  await page
    .getByRole("dialog", { name: "Tinggalkan perubahan?", exact: true })
    .getByRole("button", { name: "Batal", exact: true })
    .click();
  assert.equal(await page.getByRole("spinbutton").inputValue(), "60");
  for (const width of [320, 375, 768, 1366]) {
    await page.setViewportSize({ width, height: 900 });
    const modal = page.getByRole("dialog", { name: "Ubah usia pensiun", exact: true });
    const bounds = await modal.boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1);
    await page.screenshot({
      path: `artifacts/retirement-policy/modal-${width}.png`,
      fullPage: true,
    });
  }
  await page.getByRole("button", { name: "Batal", exact: true }).click();
  await page.getByRole("button", { name: "Buang perubahan", exact: true }).click();
  rejectSave = false;
  await page.getByRole("button", { name: "Ubah usia pensiun", exact: true }).click();
  assert.equal(await page.getByRole("spinbutton").inputValue(), "58");
  await page.getByRole("spinbutton").fill("60");
  await page
    .getByPlaceholder("Jelaskan dasar atau alasan penetapan usia pensiun")
    .fill("Kebijakan organisasi terbaru");
  await page.getByRole("button", { name: "Simpan kebijakan", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Simpan kebijakan pensiun?", exact: true })
    .getByRole("button", { name: "Simpan kebijakan", exact: true })
    .click();
  await page.getByText("60", { exact: true }).waitFor();
  assert.equal(await page.getByRole("spinbutton").count(), 0);
  canManage = false;
  await page.reload();
  await page.getByText("Perubahan kebijakan dikelola oleh HRD organisasi.").waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Ubah usia pensiun", exact: true }).count(),
    0,
  );
  configured = false;
  canManage = true;
  await page.reload();
  await page.getByRole("button", { name: "Tetapkan usia pensiun", exact: true }).waitFor();
  const longText =
    "Divisi Pengelolaan dan Pengembangan Administrasi Operasional Organisasi dengan Nama Sangat Panjang";
  const row = {
    id: "987654",
    organization_id: String(hrd.organization_id),
    full_name: "PEGAWAI PENGUJIAN DENGAN NAMA PANJANG " + "ABCDEFGHIJKLMNOP".repeat(5),
    employee_no: "000012345678901234567890",
    employment_status: "active",
    employment_type_name: longText,
    location_name: longText,
    unit_name: longText,
    position_name: longText,
    profile_photo_file_id: null,
    name: longText,
    code: "KODE".repeat(30),
    organization_name: longText,
    is_active: true,
    location_type: "market",
    admin_count: 1,
    unit_type_name: longText,
    locations: [],
    location_names: longText,
    unit_count: 1,
    sort_order: 1,
    description: longText,
  };
  const modules = [
    ["employees", "employees"],
    ["master-data/locations", "locations"],
    ["master-data/positions", "positions"],
    ["master-data/organization-unit-types", "organization-unit-types"],
    ["master-data/organization-units", "organization-units"],
    ["master-data/employment-types", "employment-types"],
    ["master-data/leave-types", "leave-types"],
  ];
  for (const [path, endpoint] of modules) {
    await page.route(`**/api/${endpoint}?*`, (route) =>
      route.fulfill({
        json: { success: true, data: [row], pagination: { total: 1, page: 1, pageSize: 10 } },
      }),
    );
    await page.setViewportSize({ width: 375, height: 900 });
    await page.goto(`${base}/${path}`);
    await page.locator("[data-responsive-card]").first().waitFor();
    for (const width of [320, 375, 430, 767]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => new Promise(requestAnimationFrame));
      const overflowing = await page.locator("[data-responsive-card]").evaluateAll((cards) =>
        cards.flatMap((card) => {
          const box = card.getBoundingClientRect();
          return [card, ...card.querySelectorAll("*")]
            .filter((element) => {
              const rect = element.getBoundingClientRect();
              return (
                rect.width > 0 &&
                (rect.right > box.right + 1 ||
                  rect.left < box.left - 1 ||
                  rect.right > innerWidth + 1)
              );
            })
            .map((element) => element.tagName + ":" + element.className);
        }),
      );
      assert.deepEqual(overflowing, [], `Isi kartu terpotong ${path} ${width}`);
      if (endpoint === "employees") {
        const name = page.getByText(row.full_name, { exact: true });
        assert.equal(
          await name.evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
          true,
        );
      }
      await page.screenshot({
        path: `artifacts/retirement-policy/${endpoint}-${width}.png`,
        fullPage: true,
      });
    }
    console.log(`PASS long-text cards ${path} 320–767`);
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS API akses, isolasi organisasi, validasi; UI 320–1920, konfirmasi, konflik versi, dirty-state, tanpa error/deprecation.",
  );
} finally {
  await browser?.close();
  await database.end();
}
