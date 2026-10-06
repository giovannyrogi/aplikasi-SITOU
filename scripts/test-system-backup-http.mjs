import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import dotenv from "dotenv";
import pg from "pg";
import bcrypt from "bcryptjs";
import { createSessionToken } from "../lib/auth/session.js";
import {
  backupNames,
  packagePath,
  artifactPath,
  assertBackupJobDirectory,
} from "../lib/system-backup/paths.mjs";

dotenv.config({ path: ".env.development", quiet: true });
assert.ok(process.env.PGDATABASE && !/prod/i.test(process.env.PGDATABASE));
const db = new pg.Pool();
const root = await mkdtemp(path.join(os.tmpdir(), "sitou-backup-http-"));
const backupRoot = path.join(root, "backups");
const uploadRoot = path.join(root, "uploads");
const users = [],
  jobId = randomUUID(),
  suffix = randomUUID().slice(0, 8);
const paginationJobIds = [];
let employeeId, server, browser;
const base = "http://127.0.0.1:3004";
const createdAt = new Date();
const timeZone = "Asia/Makassar";
try {
  await mkdir(backupRoot);
  await mkdir(uploadRoot);
  const reference = (
    await db.query(`SELECT a.organization_id,a.location_id,a.organization_unit_id
    FROM employee_assignments a JOIN organizations o ON o.id=a.organization_id AND o.is_active
    JOIN locations l ON l.organization_id=a.organization_id AND l.id=a.location_id AND l.is_active
    JOIN organization_units u ON u.organization_id=a.organization_id AND u.id=a.organization_unit_id AND u.is_active
    WHERE a.assignment_type='primary' AND a.effective_from<=current_date AND
    (a.effective_until IS NULL OR a.effective_until>=current_date) LIMIT 1`)
  ).rows[0];
  assert.ok(reference);
  const passwordHash = await bcrypt.hash(randomUUID(), 12);
  for (const role of ["superadmin", "hrd", "leader", "employee"]) {
    const user = (
      await db.query(
        `INSERT INTO users(username,password_hash) VALUES($1,$2) RETURNING id,credential_version`,
        [`qa_backup_${role}_${suffix}`, passwordHash],
      )
    ).rows[0];
    users.push(user);
    const org = role === "superadmin" ? null : reference.organization_id;
    await db.query(
      `INSERT INTO user_organization_roles(user_id,organization_id,role_id,location_scope_mode)
      SELECT $1,$2,id,'all' FROM roles WHERE code=$3`,
      [user.id, org, role],
    );
    if (role === "employee") {
      employeeId = (
        await db.query(
          `INSERT INTO employees(organization_id,user_id,employee_no,national_id,full_name,joined_date,employment_status)
        VALUES($1,$2,$3,$4,'Pegawai Uji Backup','2021-01-01','active') RETURNING id`,
          [org, user.id, `qa_backup_${suffix}`, `${Date.now()}000`],
        )
      ).rows[0].id;
      await db.query(
        `INSERT INTO employee_assignments(organization_id,employee_id,location_id,organization_unit_id,effective_from)
        VALUES($1,$2,$3,$4,'2021-01-01')`,
        [org, employeeId, reference.location_id, reference.organization_unit_id],
      );
    }
    user.cookie = `sitou_session=${await createSessionToken({
      userId: String(user.id),
      roleCode: role,
      organizationId: org ? String(org) : null,
      credentialVersion: Number(user.credential_version),
      expiresAt: Date.now() + 600000,
    })}`;
  }
  const directory = await assertBackupJobDirectory(backupRoot, jobId, createdAt, {
    create: true,
    timeZone,
  });
  const bytes = Buffer.from("opaque-backup-test-fixture");
  const hash = createHash("sha256").update(bytes).digest("hex");
  await writeFile(packagePath(backupRoot, jobId, createdAt, timeZone), bytes);
  await db.query(
    `INSERT INTO system_backup_jobs(id,requested_by_user_id,request_id,status,created_at,completed_at,
    package_path,package_sha256,package_bytes,organization_count,file_count,time_zone)
    VALUES($1,$2,$3,'ready',$4,now(),$5,$6,$7,0,0,'Asia/Makassar')`,
    [
      jobId,
      users[0].id,
      randomUUID(),
      createdAt,
      packagePath(backupRoot, jobId, createdAt, timeZone),
      hash,
      bytes.length,
    ],
  );
  for (const kind of ["database_zip", "uploads_zip"]) {
    const file = artifactPath(backupRoot, jobId, kind, createdAt, timeZone);
    await writeFile(file, bytes);
    await db.query(
      `INSERT INTO system_backup_artifacts(job_id,kind,status,internal_path,sha256,size_bytes)
      VALUES($1,$2,'ready',$3,$4,$5)`,
      [jobId, kind, file, hash, bytes.length],
    );
  }
  assert.equal((await readdir(directory)).length, 3);
  for (let index = 0; index < 25; index++) {
    const id = randomUUID();
    await db.query(
      `INSERT INTO system_backup_jobs(id,requested_by_user_id,request_id,status,created_at,completed_at)
      VALUES($1,$2,$3,'failed',$4,now())`,
      [id, users[0].id, randomUUID(), new Date(createdAt.getTime() + 3600000)],
    );
    paginationJobIds.push(id);
  }
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
        NODE_ENV: "production",
        DOTENV_CONFIG_PATH: ".env.development",
        APP_ORIGIN: base,
        BACKUP_ROOT: backupRoot,
        UPLOAD_ROOT: uploadRoot,
        BACKUP_SNAPSHOT_ROOT: path.join(root, "snapshots"),
      },
    },
  );
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Server uji tidak siap.")), 20000);
    server.stdout.on("data", (chunk) => {
      if (chunk.toString().includes("Ready")) {
        clearTimeout(timeout);
        resolve();
      }
    });
    server.once("exit", () => {
      clearTimeout(timeout);
      reject(new Error("Server uji berhenti sebelum siap."));
    });
  });
  const paths = [
    `/api/system/backups/${jobId}`,
    `/api/system/backups/${jobId}/download`,
    ...["database_zip", "uploads_zip"].map(
      (kind) => `/api/system/backups/${jobId}/artifacts/${kind}/download`,
    ),
  ];
  for (const route of ["/api/system/backups", ...paths]) {
    assert.equal((await fetch(base + route)).status, 401);
    for (const user of users.slice(1))
      assert.equal((await fetch(base + route, { headers: { Cookie: user.cookie } })).status, 403);
  }
  const headers = { Cookie: users[0].cookie, Origin: base };
  const expectedTotal = (await db.query("SELECT count(*)::int AS total FROM system_backup_jobs"))
    .rows[0].total;
  let historyCursor = null;
  const seen = [];
  for (let page = 0; page < 3; page++) {
    const response = await fetch(
      `${base}/api/system/backups?estimate=0${historyCursor ? `&cursor=${encodeURIComponent(historyCursor)}` : ""}`,
      { headers },
    );
    assert.equal(response.status, 200);
    const data = (await response.json()).data;
    assert.equal(data.total, expectedTotal);
    assert.ok(data.jobs.length <= 10);
    seen.push(...data.jobs.map((job) => job.id));
    historyCursor = data.nextCursor;
  }
  assert.equal(new Set(seen).size, seen.length);
  assert.deepEqual(seen.slice(0, 25).sort(), paginationJobIds.toSorted());
  const endCursor = Buffer.from(
    JSON.stringify({
      createdAt: "1900-01-01T00:00:00Z",
      id: "00000000-0000-0000-0000-000000000000",
    }),
  ).toString("base64url");
  const emptyPage = (
    await (
      await fetch(`${base}/api/system/backups?estimate=0&cursor=${endCursor}`, { headers })
    ).json()
  ).data;
  assert.deepEqual(emptyPage.jobs, []);
  assert.equal(emptyPage.total, expectedTotal);
  assert.equal((await fetch(`${base}/api/system/backups?cursor=invalid`, { headers })).status, 400);
  for (const [route, name] of [
    [paths[1], backupNames(jobId, createdAt, timeZone).package],
    [paths[2], backupNames(jobId, createdAt, timeZone).database_zip],
    [paths[3], backupNames(jobId, createdAt, timeZone).uploads_zip],
  ]) {
    const response = await fetch(base + route, { headers });
    assert.equal(response.status, 200);
    assert.ok(response.headers.get("content-disposition").includes(name));
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
    const partial = await fetch(base + route, { headers: { ...headers, Range: "bytes=0-4" } });
    assert.equal(partial.status, 206);
    assert.deepEqual(Buffer.from(await partial.arrayBuffer()), bytes.subarray(0, 5));
  }
  const { chromium } = await import(
    process.env.PLAYWRIGHT_MODULE_PATH ||
      "file:///C:/Users/GIOVR/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs"
  );
  browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe",
  });
  for (const [width, viewerZone, zoneLabel] of [
    [320, "Asia/Jakarta", "WIB"],
    [375, "Asia/Makassar", "WITA"],
    [1366, "Asia/Jayapura", "WIT"],
    [1366, "UTC", "UTC"],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      timezoneId: viewerZone,
    });
    await context.addCookies([
      { name: "sitou_session", value: users[0].cookie.slice("sitou_session=".length), url: base },
    ]);
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(base + "/system/backups");
    const historyNavigation = page.getByRole("navigation", { name: "Halaman riwayat backup" });
    await historyNavigation.getByText(/Halaman 1 · 10 data/).waitFor();
    assert.ok(
      (await historyNavigation.innerText()).includes(
        `Total: ${expectedTotal.toLocaleString("id-ID")} data`,
      ),
    );
    await historyNavigation.getByRole("button", { name: "Berikutnya" }).click();
    await historyNavigation.getByText(/Halaman 2 · 10 data/).waitFor();
    await historyNavigation.getByRole("button", { name: "Berikutnya" }).click();
    await historyNavigation.getByText(/Halaman 3/).waitFor();
    const expectedTime =
      new Intl.DateTimeFormat("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: viewerZone,
      }).format(createdAt) +
      " " +
      zoneLabel;
    await page.getByText(expectedTime, { exact: true }).waitFor();
    const ownRow = (
      width < 768
        ? page.locator("[data-responsive-card]")
        : page.locator(".ant-table-tbody tr.ant-table-row")
    ).filter({ has: page.getByText(expectedTime, { exact: true }) });
    await ownRow.getByRole("button", { name: "Lihat detail backup" }).click();
    const detail = page.getByRole("dialog");
    await detail.getByText("Waktu lokal Anda", { exact: true }).waitFor();
    await detail.getByText("Waktu pada nama backup", { exact: true }).waitFor();
    const originalTime =
      new Intl.DateTimeFormat("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone,
      }).format(createdAt) + " WITA";
    assert.ok((await detail.getByText(originalTime, { exact: true }).count()) > 0);
    await detail
      .getByText(backupNames(jobId, createdAt, timeZone).database_zip, { exact: true })
      .waitFor();
    assert.ok((await detail.getByText(expectedTime, { exact: true }).count()) > 0);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
      false,
    );
    await detail.getByRole("button", { name: "Tutup modal", exact: true }).click();
    await page.getByRole("button", { name: /Muat ulang/ }).click();
    await historyNavigation.getByText(/Halaman 1 · 10 data/).waitFor();
    assert.equal(
      await historyNavigation.getByRole("button", { name: "Sebelumnya" }).isEnabled(),
      false,
    );
    await historyNavigation.getByRole("button", { name: "Berikutnya" }).click();
    await historyNavigation.getByText(/Halaman 2 · 10 data/).waitFor();
    const rows =
      width < 768
        ? page.locator("[data-responsive-card]")
        : page.locator(".ant-table-tbody tr.ant-table-row");
    assert.equal(await rows.count(), 10);
    assert.ok((await rows.first().innerText()).includes("11"));
    await historyNavigation.getByRole("button", { name: "Sebelumnya" }).click();
    await historyNavigation.getByText(/Halaman 1 · 10 data/).waitFor();
    await page.getByRole("button", { name: /Buat backup/ }).click();
    const dialog = page.getByRole("dialog");
    await dialog.waitFor();
    const field = dialog.getByLabel("Kata sandi backup", { exact: true });
    await field.fill("a");
    await page.getByText("Perkiraan kekuatan kata sandi: Lemah", { exact: true }).waitFor();
    await dialog.getByLabel("Ulangi kata sandi", { exact: true }).fill("a");
    assert.equal(
      await dialog.getByRole("button", { name: "Mulai backup", exact: true }).isEnabled(),
      true,
    );
    await field.fill("vR8!kL3#tM9$pX4&zN2@");
    await page.getByText("Perkiraan kekuatan kata sandi: Kuat", { exact: true }).waitFor();
    await field.fill("vR8kL3tM");
    await page.getByText("Perkiraan kekuatan kata sandi: Sedang", { exact: true }).waitFor();
    await field.fill("aaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    await page.getByText("Perkiraan kekuatan kata sandi: Lemah", { exact: true }).waitFor();
    await field.fill("");
    assert.equal(await dialog.getByRole("progressbar").count(), 0);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
      false,
    );
    await dialog.getByRole("button", { name: "Tutup modal" }).click();
    await page.getByRole("button", { name: /Buat backup/ }).click();
    assert.equal(await dialog.getByLabel("Kata sandi backup", { exact: true }).inputValue(), "");
    assert.deepEqual(errors, []);
    await context.close();
  }
  for (const width of [320, 1366]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    await context.addCookies([
      { name: "sitou_session", value: users[0].cookie.slice("sitou_session=".length), url: base },
    ]);
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    let total = 1170;
    await page.route("**/api/reports/**", (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            rows: [],
            total,
            rowOffset: 0,
            employeeCount: total,
            organization: {
              id: reference.organization_id,
              name: "Organisasi Uji",
              retirement_age: 58,
            },
            filters: {},
            asOf: "2026-10-06",
            generatedAt: createdAt.toISOString(),
            nextCursor: null,
          },
        }),
      }),
    );
    for (const kind of ["expiring-contracts", "retirements", "disciplinary-actions"]) {
      total = 1170;
      await page.goto(`${base}/reports/${kind}?organizationId=${reference.organization_id}`);
      await page.getByText("Total: 1.170 data", { exact: true }).waitFor();
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
        false,
      );
      total = 0;
      await page.reload();
      await page.getByText("Total: 0 data", { exact: true }).waitFor();
    }
    assert.deepEqual(errors, []);
    await context.close();
  }
  await writeFile(path.join(directory, "unknown.txt"), "preserve");
  for (let i = 0; i < 2; i++)
    assert.equal((await fetch(base + paths[0], { method: "DELETE", headers })).status, 200);
  assert.deepEqual(await readdir(directory), ["unknown.txt"]);
  assert.equal(await readFile(path.join(directory, "unknown.txt"), "utf8"), "preserve");
  for (const route of paths.slice(1))
    assert.equal((await fetch(base + route, { headers })).status, 404);
  console.log(
    "PASS HTTP/UI backup: izin empat role, unduhan bertanggal/range, hapus idempotent, file asing aman, indikator dan layout 320/375/1366.",
  );
} finally {
  if (browser) await browser.close();
  if (server) {
    server.kill();
    await new Promise((resolve) =>
      server.exitCode !== null ? resolve() : server.once("exit", resolve),
    );
  }
  await db.query("DELETE FROM audit_logs WHERE actor_user_id=ANY($1::bigint[])", [
    users.map((user) => user.id),
  ]);
  await db.query("DELETE FROM system_backup_jobs WHERE id=$1", [jobId]);
  await db.query("DELETE FROM system_backup_jobs WHERE id=ANY($1::uuid[])", [paginationJobIds]);
  if (employeeId) {
    await db.query("DELETE FROM employee_assignments WHERE employee_id=$1", [employeeId]);
    await db.query("DELETE FROM employees WHERE id=$1", [employeeId]);
  }
  for (const user of users) {
    await db.query("DELETE FROM user_organization_roles WHERE user_id=$1", [user.id]);
    await db.query("DELETE FROM users WHERE id=$1", [user.id]);
  }
  await db.end();
  const absolute = path.resolve(root);
  assert.ok(
    absolute.startsWith(path.resolve(os.tmpdir()) + path.sep) &&
      path.basename(absolute).startsWith("sitou-backup-http-"),
  );
  await rm(absolute, { recursive: true, force: true });
}
