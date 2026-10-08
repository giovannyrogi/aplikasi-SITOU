import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import dotenv from "dotenv";
import pg from "pg";
import bcrypt from "bcryptjs";
import ExcelJS from "exceljs";
import { createSessionToken } from "../lib/auth/session.js";
import { calculateEmployeeAge } from "../lib/employees/age.mjs";
import { buildReportQuery } from "../lib/reports/query.mjs";
import {
  EMPLOYEE_IMPORT_SHEETS,
  EMPLOYEE_IMPORT_TEMPLATE_SUBJECT,
  getImportExample,
} from "../lib/employees/importDefinition.js";

dotenv.config({ path: ".env.development", quiet: true });
assert.ok(process.env.PGDATABASE && !/prod/i.test(process.env.PGDATABASE));
const db = new pg.Pool();
const tempRoot = await mkdtemp(path.join(os.tmpdir(), "sitou-age-contract-"));
const importBatches = [];
let clam;
const suffix = randomUUID().slice(0, 8),
  base = "http://127.0.0.1:3004";
let actorId,
  employeeId,
  otherEmployee,
  otherOrg,
  fixedId,
  termId,
  closedId,
  activeId,
  browser,
  server;
try {
  const ref = (
    await db.query(`SELECT a.organization_id,a.location_id,a.organization_unit_id FROM employee_assignments a
    JOIN organizations o ON o.id=a.organization_id AND o.is_active
    WHERE a.assignment_type='primary' AND a.effective_from<=current_date AND (a.effective_until IS NULL OR a.effective_until>=current_date) LIMIT 1`)
  ).rows[0];
  assert.ok(ref);
  const org = String(ref.organization_id);
  actorId = (
    await db.query("INSERT INTO users(username,password_hash) VALUES($1,$2) RETURNING id", [
      `qa_contract_${suffix}`,
      await bcrypt.hash(randomUUID(), 12),
    ])
  ).rows[0].id;
  await db.query(
    "INSERT INTO user_organization_roles(user_id,organization_id,role_id,location_scope_mode) SELECT $1,$2,id,'all' FROM roles WHERE code='hrd'",
    [actorId, org],
  );
  fixedId = (
    await db.query(
      "INSERT INTO employment_types(organization_id,code,name,requires_end_date) VALUES($1,$2,$3,false) RETURNING id",
      [org, `QA_FIX_${suffix}`, `Jenis Tanpa Akhir Uji ${suffix}`],
    )
  ).rows[0].id;
  termId = (
    await db.query(
      "INSERT INTO employment_types(organization_id,code,name,requires_end_date) VALUES($1,$2,$3,true) RETURNING id",
      [org, `QA_TERM_${suffix}`, `Jenis Berakhir Uji ${suffix}`],
    )
  ).rows[0].id;
  employeeId = (
    await db.query(
      `INSERT INTO employees(organization_id,employee_no,national_id,full_name,birth_date,joined_date,employment_status)
    VALUES($1,$2,$3,$4,'1968-08-05','2020-01-01','active') RETURNING id`,
      [org, `QA_AGE_${suffix}`, `${Date.now()}000`, `Pegawai Uji Usia ${suffix}`],
    )
  ).rows[0].id;
  await db.query(
    "INSERT INTO employee_assignments(organization_id,employee_id,location_id,organization_unit_id,effective_from) VALUES($1,$2,$3,$4,'2020-01-01')",
    [org, employeeId, ref.location_id, ref.organization_unit_id],
  );
  closedId = (
    await db.query(
      "INSERT INTO employment_contracts(organization_id,employee_id,employment_type_id,contract_no,start_date,end_date,status) VALUES($1,$2,$3,$4,'2020-01-01','2020-12-31','renewed') RETURNING id",
      [org, employeeId, fixedId, `QA_OLD_${suffix}`],
    )
  ).rows[0].id;
  activeId = (
    await db.query(
      "INSERT INTO employment_contracts(organization_id,employee_id,employment_type_id,contract_no,start_date,end_date,status) VALUES($1,$2,$3,$4,'2021-01-01',current_date+5,'active') RETURNING id",
      [org, employeeId, fixedId, `QA_NOW_${suffix}`],
    )
  ).rows[0].id;
  otherOrg = (
    await db.query(
      "INSERT INTO organizations(code,name) VALUES($1,'Organisasi Uji Isolasi Kontrak') RETURNING id",
      [`QA_OTHER_${suffix}`],
    )
  ).rows[0].id;
  otherEmployee = (
    await db.query(
      "INSERT INTO employees(organization_id,employee_no,national_id,full_name,joined_date) VALUES($1,$2,$3,'Pegawai Uji Lintas Organisasi','2020-01-01') RETURNING id",
      [otherOrg, `QA_B_${suffix}`, `${Date.now()}001`],
    )
  ).rows[0].id;
  const cookie = `sitou_session=${await createSessionToken({ userId: String(actorId), roleCode: "hrd", organizationId: org, credentialVersion: 1, expiresAt: Date.now() + 600000 })}`;
  const headers = { Cookie: cookie, Origin: base };
  clam = createServer((socket) => {
    let pending = Buffer.alloc(0),
      commandRead = false;
    socket.on("data", (chunk) => {
      pending = Buffer.concat([pending, chunk]);
      if (!commandRead) {
        const index = pending.indexOf(0);
        if (index < 0) return;
        pending = pending.subarray(index + 1);
        commandRead = true;
      }
      while (pending.length >= 4) {
        const size = pending.readUInt32BE(0);
        if (pending.length < 4 + size) return;
        pending = pending.subarray(4 + size);
        if (!size) {
          socket.end("stream: OK\0");
          return;
        }
      }
    });
  });
  await new Promise((resolve) => clam.listen(0, "127.0.0.1", resolve));
  await mkdir(path.join(tempRoot, "uploads"));
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
        UPLOAD_ROOT: path.join(tempRoot, "uploads"),
        CLAMAV_HOST: "127.0.0.1",
        CLAMAV_PORT: String(clam.address().port),
      },
    },
  );
  server.stderr.on("data", (chunk) => process.stderr.write(chunk));
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Server uji belum siap.")), 20000);
    server.stdout.on("data", (chunk) => {
      if (chunk.toString().includes("Ready")) {
        clearTimeout(timer);
        resolve();
      }
    });
    server.once("exit", () => {
      clearTimeout(timer);
      reject(new Error("Server uji gagal mulai."));
    });
  });
  const url = `/api/employees/${employeeId}?organizationId=${org}`;
  const employee = (await (await fetch(base + url, { headers })).json()).data;
  assert.equal(employee.contract_requires_end_date, false);
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(employee.organization_today));
  const age = calculateEmployeeAge({
    birthDate: employee.birth_date,
    today: employee.organization_today,
  });
  assert.equal(age.valid, true);
  assert.equal((await fetch(base + url)).status, 401);
  assert.equal(
    (await fetch(`${base}/api/employees/${otherEmployee}?organizationId=${otherOrg}`, { headers }))
      .status,
    403,
  );
  const version = async (id) =>
    new Date(
      (await db.query("SELECT updated_at FROM employment_contracts WHERE id=$1", [id])).rows[0]
        .updated_at,
    ).toISOString();
  const patch = async (id, endDate, changes = {}) => {
    const payload = {
      organizationId: org,
      employmentTypeId: String(fixedId),
      contractNo: `QA_${suffix}`,
      startDate: id === closedId ? "2020-01-01" : "2021-01-01",
      endDate,
      documentFileId: null,
      notes: "Catatan uji",
      version: await version(id),
      ...changes,
    };
    const body = new FormData();
    body.append("payload", JSON.stringify(payload));
    const response = await fetch(`${base}/api/employees/${employeeId}/contracts/${id}`, {
      method: "PATCH",
      headers,
      body,
    });
    return { status: response.status, body: await response.json() };
  };
  const rejected = await patch(activeId, "2026-12-31");
  assert.equal(rejected.status, 400);
  assert.equal(rejected.body.code, "CONTRACT_END_NOT_APPLICABLE");
  assert.ok(rejected.body.fieldErrors.endDate);
  const required = await patch(activeId, null, { employmentTypeId: String(termId) });
  assert.equal(required.body.code, "CONTRACT_END_REQUIRED");
  const newContractBody = new FormData();
  newContractBody.append(
    "payload",
    JSON.stringify({
      organizationId: org,
      employmentTypeId: String(fixedId),
      startDate: "2030-01-01",
      endDate: "2030-12-31",
      status: "draft",
    }),
  );
  const newContract = await fetch(`${base}/api/employees/${employeeId}/contracts`, {
    method: "POST",
    headers,
    body: newContractBody,
  });
  assert.equal(newContract.status, 400);
  assert.equal((await newContract.json()).code, "CONTRACT_END_NOT_APPLICABLE");
  assert.equal((await patch(activeId, null)).status, 200);
  assert.equal(
    (await db.query("SELECT end_date FROM employment_contracts WHERE id=$1", [activeId])).rows[0]
      .end_date,
    null,
  );
  assert.equal((await patch(closedId, null)).status, 200);
  assert.equal(
    (await db.query("SELECT end_date::text FROM employment_contracts WHERE id=$1", [closedId]))
      .rows[0].end_date,
    "2020-12-31",
  );
  const invalidHistory = await patch(closedId, "2020-11-30");
  assert.equal(invalidHistory.body.code, "CONTRACT_END_NOT_APPLICABLE");
  const stale = await patch(activeId, null, { version: "2000-01-01T00:00:00.000Z" });
  assert.equal(stale.body.code, "VERSION_CONFLICT");
  await db.query("UPDATE employment_contracts SET end_date=current_date+5 WHERE id=$1", [activeId]);
  const reportUrl = `${base}/api/reports/expiring-contracts?organizationId=${org}&search=${suffix}&group=all`;
  const report = async () => (await (await fetch(reportUrl, { headers })).json()).data;
  assert.equal((await report()).total, 0);
  await db.query("UPDATE employment_types SET requires_end_date=true WHERE id=$1", [fixedId]);
  assert.equal((await report()).total, 1);
  await db.query("UPDATE employment_types SET requires_end_date=false WHERE id=$1", [fixedId]);
  const originalEnd = (
    await db.query("SELECT end_date::text FROM employment_contracts WHERE id=$1", [activeId])
  ).rows[0].end_date;
  const futureId = (
    await db.query(
      "INSERT INTO employment_contracts(organization_id,employee_id,employment_type_id,start_date,end_date,status) VALUES($1,$2,$3,current_date+10,NULL,'draft') RETURNING id",
      [org, employeeId, fixedId],
    )
  ).rows[0].id;
  const overlap = await patch(activeId, null);
  assert.equal(overlap.body.code, "CONTRACT_OVERLAP");
  assert.ok(overlap.body.fieldErrors.startDate);
  assert.equal(
    (await db.query("SELECT end_date::text FROM employment_contracts WHERE id=$1", [activeId]))
      .rows[0].end_date,
    originalEnd,
  );
  await db.query("DELETE FROM employment_contracts WHERE id=$1", [futureId]);
  const otherLocation = (
    await db.query(
      "SELECT id FROM locations WHERE organization_id=$1 AND id<>$2 AND is_active AND operational_from<=current_date AND (operational_until IS NULL OR operational_until>=current_date) LIMIT 1",
      [org, ref.location_id],
    )
  ).rows[0];
  if (otherLocation) {
    const membership = (
      await db.query(
        "UPDATE user_organization_roles SET location_scope_mode='selected' WHERE user_id=$1 AND organization_id=$2 RETURNING id",
        [actorId, org],
      )
    ).rows[0].id;
    await db.query(
      "INSERT INTO user_location_scopes(user_organization_role_id,organization_id,location_id) VALUES($1,$2,$3)",
      [membership, org, otherLocation.id],
    );
    assert.equal((await fetch(base + url, { headers })).status, 403);
    await db.query("DELETE FROM user_location_scopes WHERE user_organization_role_id=$1", [
      membership,
    ]);
    await db.query("UPDATE user_organization_roles SET location_scope_mode='all' WHERE id=$1", [
      membership,
    ]);
  }
  const exported = await fetch(
    `${base}/api/employees/export?organizationId=${org}&search=${suffix}`,
    { headers },
  );
  assert.equal(exported.status, 200);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(await exported.arrayBuffer()));
  const sheet = wb.getWorksheet("Riwayat Kontrak");
  assert.ok(sheet);
  const values = [];
  sheet.eachRow((row, index) => {
    if (index > 1) values.push(row.values);
  });
  assert.ok(values.some((row) => row.includes(`QA_${suffix}`) && row.includes("Tidak berlaku")));
  const uploadImport = async (requiresEndDate, suppliedEnd, index) => {
    await db.query("UPDATE employment_types SET requires_end_date=$1 WHERE id=$2", [
      requiresEndDate,
      fixedId,
    ]);
    const workbook = new ExcelJS.Workbook();
    workbook.subject = EMPLOYEE_IMPORT_TEMPLATE_SUBJECT;
    workbook.addWorksheet("Petunjuk");
    workbook.addWorksheet("Referensi").state = "hidden";
    const nip = "QA_IMPORT_" + suffix + "_" + index;
    const locationCode = (
      await db.query("SELECT code FROM locations WHERE id=$1", [ref.location_id])
    ).rows[0].code;
    const unitCode = (
      await db.query("SELECT code FROM organization_units WHERE id=$1", [ref.organization_unit_id])
    ).rows[0].code;
    for (const definition of EMPLOYEE_IMPORT_SHEETS) {
      const sheet = workbook.addWorksheet(definition.name);
      sheet.columns = definition.columns.map(([key, header]) => ({ key, header }));
      if (definition.name === "Pegawai")
        sheet.addRow({
          ...getImportExample("Pegawai"),
          employeeNo: nip,
          fullName: "Pegawai Uji Import Kontrak",
          nationalId: String(Date.now()) + "000",
          employmentStatus: "active",
          joinedDate: employee.organization_today,
        });
      if (definition.name === "Kontrak")
        sheet.addRow({
          ...getImportExample("Kontrak"),
          employeeNo: nip,
          contractRef: "KON-UJI",
          employmentTypeCode: "QA_FIX_" + suffix,
          startDate: employee.organization_today,
          endDate: suppliedEnd,
          status: "active",
        });
      if (definition.name === "Penempatan")
        sheet.addRow({
          ...getImportExample("Penempatan"),
          employeeNo: nip,
          assignmentRef: "PEN-UJI",
          locationCode,
          unitCode,
          positionCode: null,
          supervisorEmployeeNo: null,
          effectiveFrom: employee.organization_today,
          effectiveUntil: null,
        });
    }
    const body = new FormData();
    body.append("organizationId", org);
    body.append(
      "file",
      new Blob([await workbook.xlsx.writeBuffer()], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      "fixture.xlsx",
    );
    const response = await fetch(base + "/api/employees/imports", {
      method: "POST",
      headers,
      body,
    });
    const data = await response.json();
    assert.equal(response.status, 201, data.message);
    importBatches.push(data.data.id);
    return data.data;
  };
  const invalidImport = await uploadImport(false, "2026-12-31", 1);
  assert.ok(
    invalidImport.groups[0].errors.some(
      (error) =>
        error.sheetName === "Kontrak" &&
        error.rowNumber === 2 &&
        error.message.includes("Tanggal akhir tidak digunakan"),
    ),
  );
  const validImport = await uploadImport(false, null, 2);
  assert.equal(
    Number(validImport.invalid_employees),
    0,
    JSON.stringify(validImport.groups[0].errors),
  );
  const requiredImport = await uploadImport(true, null, 3);
  assert.ok(
    requiredImport.groups[0].errors.some(
      (error) => error.sheetName === "Kontrak" && error.message.includes("Tanggal akhir wajib"),
    ),
  );
  const staleImport = await uploadImport(true, "2026-12-31", 4);
  assert.equal(
    Number(staleImport.invalid_employees),
    0,
    JSON.stringify(staleImport.groups[0].errors),
  );
  await db.query("UPDATE employment_types SET requires_end_date=false WHERE id=$1", [fixedId]);
  const committed = await fetch(
    base + "/api/employees/imports/" + staleImport.id + "/commit?organizationId=" + org,
    { method: "POST", headers },
  );
  assert.equal(committed.status, 200);
  assert.equal(
    Number(
      (
        await db.query("SELECT committed_employees FROM employee_import_batches WHERE id=$1", [
          staleImport.id,
        ])
      ).rows[0].committed_employees,
    ),
    0,
  );
  const skipped = await db.query(
    "SELECT validation_errors FROM employee_import_rows WHERE batch_id=$1 AND sheet_name='Kontrak'",
    [staleImport.id],
  );
  assert.ok(
    skipped.rows[0].validation_errors.some((message) =>
      message.includes("Kontrak baris 2: Tanggal akhir tidak digunakan"),
    ),
  );
  const acceptedImport = await fetch(
    base + "/api/employees/imports/" + validImport.id + "/commit?organizationId=" + org,
    { method: "POST", headers },
  );
  assert.equal(acceptedImport.status, 200);
  const imported = await db.query(
    "SELECT contract.end_date FROM employment_contracts contract JOIN employees employee ON employee.id=contract.employee_id AND employee.organization_id=contract.organization_id WHERE employee.employee_no=$1 AND employee.organization_id=$2",
    [("QA_IMPORT_" + suffix + "_2").toUpperCase(), org],
  );
  assert.equal(imported.rowCount, 1);
  assert.equal(imported.rows[0].end_date, null);
  const query = buildReportQuery(
    "expiring-contracts",
    { group: "upcoming", successor: "all" },
    org,
    null,
    employee.organization_today,
    11,
  );
  const execution = await db.query(
    "EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) " + query.text,
    query.values,
  );
  assert.ok(Number.isFinite(execution.rows[0]["QUERY PLAN"][0]["Execution Time"]));
  const { chromium } = await import(
    process.env.PLAYWRIGHT_MODULE_PATH ||
      "file:///C:/Users/GIOVR/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs"
  );
  browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe",
  });
  for (const width of [320, 1366]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      timezoneId: "UTC",
    });
    await context.addCookies([
      { name: "sitou_session", value: cookie.slice("sitou_session=".length), url: base },
    ]);
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${base}/employees/${employeeId}?organizationId=${org}`);
    await page.getByText(age.duration, { exact: true }).waitFor();
    assert.equal(await page.getByText("Akhir kontrak", { exact: true }).count(), 0);
    await page.getByRole("tab", { name: /Kontrak/ }).click();
    await page.getByText(/Tanggal penutupan periode:/).waitFor();
    await page
      .getByRole("button", { name: /Edit kontrak/ })
      .first()
      .click();
    const dialog = page.getByRole("dialog");
    await dialog.waitFor();
    assert.equal(await dialog.getByLabel("Tanggal akhir", { exact: true }).count(), 0);
    await dialog.getByText(/Tanggal akhir yang tercatat akan dihapus/).waitFor();
    await dialog.getByLabel("Jenis kepegawaian", { exact: true }).click();
    await page
      .locator(".ant-select-item-option-content")
      .filter({ hasText: `Jenis Berakhir Uji ${suffix}` })
      .click();
    await dialog.getByLabel("Tanggal akhir", { exact: true }).waitFor();
    await dialog.getByRole("button", { name: "Simpan koreksi", exact: true }).click();
    await dialog
      .getByText("Tanggal akhir wajib diisi untuk jenis kepegawaian ini.", { exact: true })
      .waitFor();
    await dialog.getByLabel("Jenis kepegawaian", { exact: true }).click();
    await page
      .locator(".ant-select-item-option-content")
      .filter({ hasText: `Jenis Tanpa Akhir Uji ${suffix}` })
      .click();
    assert.equal(await dialog.getByLabel("Tanggal akhir", { exact: true }).count(), 0);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
      false,
    );
    assert.deepEqual(errors, []);
    await context.close();
  }
  await db.query(
    "UPDATE employees SET employment_status='deceased',termination_date='2025-08-05',termination_reason='Profil uji usia saat meninggal' WHERE id=$1",
    [employeeId],
  );
  assert.equal((await patch(activeId, null)).status, 409);
  const deceasedContext = await browser.newContext({
    viewport: { width: 1366, height: 900 },
    timezoneId: "America/Los_Angeles",
  });
  await deceasedContext.addCookies([
    { name: "sitou_session", value: cookie.slice("sitou_session=".length), url: base },
  ]);
  const deceasedPage = await deceasedContext.newPage();
  await deceasedPage.goto(`${base}/employees/${employeeId}?organizationId=${org}`);
  await deceasedPage.getByText("Usia saat meninggal", { exact: true }).waitFor();
  await deceasedPage.getByText("57 tahun 0 bulan 0 hari", { exact: true }).waitFor();
  await deceasedContext.close();
  console.log(
    "PASS usia/kontrak: API/database, tanggal akhir dinamis, histori, field error, version check, isolasi organisasi/scope, import/export/laporan, EXPLAIN, status final dan UI 320/1366.",
  );
} finally {
  await browser?.close();
  if (server) {
    server.kill();
    await new Promise((resolve) =>
      server.exitCode !== null ? resolve() : server.once("exit", resolve),
    );
  }
  if (clam) await new Promise((resolve) => clam.close(resolve));
  for (const batch of importBatches) {
    await db.query("DELETE FROM employee_import_rows WHERE batch_id=$1", [batch]);
    await db.query("DELETE FROM employee_import_batches WHERE id=$1", [batch]);
  }
  if (actorId) await db.query("DELETE FROM stored_files WHERE uploaded_by_user_id=$1", [actorId]);
  if (actorId) await db.query("DELETE FROM audit_logs WHERE actor_user_id=$1", [actorId]);
  const importedEmployees = await db.query("SELECT id FROM employees WHERE employee_no=$1", [
    ("QA_IMPORT_" + suffix + "_2").toUpperCase(),
  ]);
  for (const imported of importedEmployees.rows) {
    await db.query("DELETE FROM employment_contracts WHERE employee_id=$1", [imported.id]);
    await db.query("DELETE FROM employee_assignments WHERE employee_id=$1", [imported.id]);
    await db.query("DELETE FROM employees WHERE id=$1", [imported.id]);
  }
  if (employeeId) {
    await db.query("DELETE FROM employment_contracts WHERE employee_id=$1", [employeeId]);
    await db.query("DELETE FROM employee_assignments WHERE employee_id=$1", [employeeId]);
    await db.query("DELETE FROM employees WHERE id=$1", [employeeId]);
  }
  if (otherEmployee) await db.query("DELETE FROM employees WHERE id=$1", [otherEmployee]);
  if (otherOrg) await db.query("DELETE FROM organizations WHERE id=$1", [otherOrg]);
  for (const id of [fixedId, termId].filter(Boolean))
    await db.query("DELETE FROM employment_types WHERE id=$1", [id]);
  if (actorId) {
    await db.query("DELETE FROM user_organization_roles WHERE user_id=$1", [actorId]);
    await db.query("DELETE FROM users WHERE id=$1", [actorId]);
  }
  await db.end();
  assert.ok(
    path.resolve(tempRoot).startsWith(path.resolve(os.tmpdir()) + path.sep) &&
      path.basename(tempRoot).startsWith("sitou-age-contract-"),
  );
  await rm(tempRoot, { recursive: true, force: true });
}
