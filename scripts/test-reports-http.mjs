import assert from "node:assert/strict";
import dotenv from "dotenv";
import pg from "pg";
import ExcelJS from "exceljs";
import { createSessionToken, SESSION_COOKIE_NAME } from "../lib/auth/session.js";
dotenv.config({ path: ".env.development", quiet: true });
const base = process.env.SITOU_TEST_BASE_URL || "http://localhost:3000";
const pool = new pg.Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
});

/** Sesi QA berumur pendek tidak dicetak atau disimpan sebagai fixture. */
async function headers(actor) {
  const token = await createSessionToken({
    userId: String(actor.id),
    roleCode: actor.role_code,
    organizationId: actor.organization_id ? String(actor.organization_id) : null,
    credentialVersion: Number(actor.credential_version),
    expiresAt: Date.now() + 600000,
  });
  return { Cookie: `${SESSION_COOKIE_NAME}=${token}`, Origin: base };
}
try {
  const actors = (
    await pool.query(`SELECT DISTINCT ON (r.code) u.id,u.credential_version,r.code AS role_code,m.organization_id
    FROM users u JOIN user_organization_roles m ON m.user_id=u.id JOIN roles r ON r.id=m.role_id
    WHERE u.is_active AND m.active_from<=now() AND (m.active_until IS NULL OR m.active_until>now()) ORDER BY r.code,u.id`)
  ).rows;
  const org = (
    await pool.query("SELECT id::text FROM organizations WHERE is_active ORDER BY id LIMIT 1")
  ).rows[0];
  assert.ok(org, "Organisasi lokal diperlukan untuk smoke test");
  for (const kind of ["retirements", "expiring-contracts"]) {
    assert.equal((await fetch(`${base}/api/reports/${kind}`)).status, 401);
  }
  for (const actor of actors) {
    const auth = await headers(actor);
    const organizationId = actor.organization_id || org.id;
    for (const kind of ["retirements", "expiring-contracts"]) {
      const query = new URLSearchParams({ organizationId: String(organizationId) });
      const response = await fetch(`${base}/api/reports/${kind}?${query}`, { headers: auth });
      if (actor.role_code === "employee") {
        assert.ok([401, 403].includes(response.status));
        continue;
      }
      const body = await response.json();
      assert.equal(response.status, 200, `${actor.role_code}: ${body.message}`);
      assert.ok(Array.isArray(body.data.rows));
      assert.ok(body.data.asOf);
      const invalid = await fetch(
        `${base}/api/reports/${kind}?${query}&period=custom&startDate=2026-02-31&endDate=2026-02-01`,
        { headers: auth },
      );
      assert.equal(invalid.status, 400);
      assert.ok((await invalid.json()).fieldErrors);
      if (actor.role_code !== "superadmin") {
        const cross = await fetch(`${base}/api/reports/${kind}?organizationId=999999999`, {
          headers: auth,
        });
        assert.equal(cross.status, 403);
        const crossExport = await fetch(
          `${base}/api/reports/${kind}/export?organizationId=999999999`,
          { headers: auth },
        );
        assert.equal(crossExport.status, 403);
      }
      const exported = await fetch(`${base}/api/reports/${kind}/export?${query}`, {
        headers: auth,
      });
      assert.equal(exported.status, 200);
      assert.match(exported.headers.get("cache-control"), /no-store/);
      const book = new ExcelJS.Workbook();
      await book.xlsx.load(Buffer.from(await exported.arrayBuffer()));
      assert.ok(book.worksheets[0].rowCount > 0);
      const page = await fetch(`${base}/reports/${kind}?${query}`, {
        headers: auth,
        redirect: "manual",
      });
      assert.equal(page.status, 200);
    }
    if (actor.role_code !== "employee") {
      const response = await fetch(
        `${base}/api/dashboard/summary?organizationId=${organizationId}`,
        { headers: auth },
      );
      const body = await response.json();
      assert.equal(response.status, 200);
      assert.equal(body.data.metrics.length, 6);
      for (const metric of [
        body.data.retirementSummary.upcoming,
        body.data.retirementSummary.overdue,
        body.data.metrics.find((item) => item.key === "expiringContracts"),
      ]) {
        assert.ok(metric);
        const url = new URL(metric.href, base);
        url.pathname = `/api${url.pathname}`;
        const result = await fetch(url, { headers: auth });
        assert.equal(result.status, 200);
        const report = (await result.json()).data;
        assert.equal(report.total, metric.value);
        if (metric.rows) {
          assert.ok(metric.rows.length <= 5);
          assert.deepEqual(
            metric.rows.map((row) => row.employee_id),
            report.rows.slice(0, 5).map((row) => row.employee_id),
          );
        }
      }
    }
    console.log(
      `PASS HTTP ${actor.role_code}: laporan, filter, ekspor, halaman, dan konsistensi dashboard.`,
    );
  }
  const audit = await pool.query(
    "SELECT count(*)::int AS count FROM audit_logs WHERE action='report.export' AND occurred_at>now()-interval '10 minutes'",
  );
  assert.ok(audit.rows[0].count > 0);
  console.log("PASS audit ekspor. Role tanpa akun aktif lokal tidak diuji melalui HTTP.");
} finally {
  await pool.end();
}
