import assert from "node:assert/strict";
import dotenv from "dotenv";
import pg from "pg";
import { createSessionToken, SESSION_COOKIE_NAME } from "../lib/auth/session.js";

dotenv.config({ path: ".env.development", quiet: true });

const baseUrl = process.env.SITOU_TEST_BASE_URL || "http://localhost:3000";
const pool = new pg.Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
});

/** Menguji bahwa opsi dan daftar memakai audit pencatatan yang sama tanpa mencetak data pegawai. */
try {
  const {
    rows: [actor],
  } = await pool.query(
    `SELECT user_account.id,user_account.credential_version,role.code AS role_code,membership.organization_id
     FROM users user_account
     JOIN user_organization_roles membership ON membership.user_id=user_account.id
     JOIN roles role ON role.id=membership.role_id
     WHERE role.code IN ('hrd','leader') AND user_account.is_active=true
       AND membership.active_from<=now() AND (membership.active_until IS NULL OR membership.active_until>now())
     ORDER BY role.code='hrd' DESC,user_account.id LIMIT 1`,
  );
  assert.ok(actor, "Akun HRD atau Pimpinan lokal diperlukan untuk uji filter pembuat.");
  const token = await createSessionToken({
    userId: String(actor.id),
    roleCode: actor.role_code,
    organizationId: String(actor.organization_id),
    credentialVersion: Number(actor.credential_version),
    expiresAt: Date.now() + 10 * 60 * 1000,
  });
  const headers = { Cookie: `${SESSION_COOKIE_NAME}=${token}`, Origin: baseUrl };
  const optionsResponse = await fetch(
    `${baseUrl}/api/employees/reference-options?organizationId=${actor.organization_id}`,
    { headers },
  );
  const options = await optionsResponse.json();
  assert.equal(optionsResponse.status, 200);
  assert.ok(Array.isArray(options.data.createdByUsers));
  const creator = options.data.createdByUsers[0];
  if (creator) {
    const response = await fetch(
      `${baseUrl}/api/employees?organizationId=${actor.organization_id}&createdByUserId=${creator.id}&page=1&pageSize=10`,
      { headers },
    );
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.ok(Array.isArray(body.data));
  }
  const invalid = await fetch(
    `${baseUrl}/api/employees?organizationId=${actor.organization_id}&createdByUserId=invalid`,
    { headers },
  );
  assert.equal(invalid.status, 400);
  const missingResponse = await fetch(
    `${baseUrl}/api/employees?employmentTypeId=without_active_contract&pageSize=100`,
    { headers },
  );
  assert.equal(missingResponse.status, 200);
  const missing = await missingResponse.json();
  for (const employee of missing.data) {
    assert.equal(String(employee.organization_id), String(actor.organization_id));
    assert.ok(["active", "probation", "suspended"].includes(employee.employment_status));
    const active = await pool.query(
      `SELECT count(*)::int AS total FROM employment_contracts
      WHERE organization_id=$1 AND employee_id=$2 AND status='active' AND start_date<=current_date
      AND (end_date IS NULL OR end_date>=current_date)`,
      [actor.organization_id, employee.id],
    );
    assert.equal(active.rows[0].total, 0);
  }
  const dashboardResponse = await fetch(`${baseUrl}/api/dashboard/summary`, { headers });
  assert.equal(dashboardResponse.status, 200);
  const dashboard = await dashboardResponse.json();
  const incompleteResponse = await fetch(`${baseUrl}/api/employees?completeness=incomplete`, {
    headers,
  });
  assert.equal(incompleteResponse.status, 200);
  const incomplete = await incompleteResponse.json();
  assert.equal(
    incomplete.pagination.total,
    dashboard.data.metrics.find((item) => item.key === "incompleteProfiles").value,
  );
  const completeResponse = await fetch(`${baseUrl}/api/employees?completeness=complete`, {
    headers,
  });
  assert.equal(completeResponse.status, 200);
  const complete = await completeResponse.json();
  const allResponse = await fetch(`${baseUrl}/api/employees`, { headers });
  const all = await allResponse.json();
  assert.equal(incomplete.pagination.total + complete.pagination.total, all.pagination.total);
  assert.equal(
    (await fetch(`${baseUrl}/api/employees?completeness=invalid`, { headers })).status,
    400,
  );
  const findChart = (value) =>
    value && typeof value === "object"
      ? value.employmentType || Object.values(value).map(findChart).find(Boolean)
      : null;
  const chart = findChart(dashboard.data);
  assert.ok(chart);
  const index = chart.categories.indexOf("Tanpa kontrak aktif");
  assert.equal(missing.pagination.total, index < 0 ? 0 : chart.series[0].data[index]);
  const invalidType = await fetch(`${baseUrl}/api/employees?employmentTypeId=invalid`, { headers });
  assert.equal(invalidType.status, 400);
  const otherOrg = await pool.query("SELECT id FROM organizations WHERE id<>$1 LIMIT 1", [
    actor.organization_id,
  ]);
  if (otherOrg.rows.length) {
    assert.equal(
      (
        await fetch(
          `${baseUrl}/api/employees?completeness=incomplete&organizationId=${otherOrg.rows[0].id}`,
          { headers },
        )
      ).status,
      403,
    );
    const cross = await fetch(
      `${baseUrl}/api/employees?employmentTypeId=without_active_contract&organizationId=${otherOrg.rows[0].id}`,
      { headers },
    );
    assert.equal(cross.status, 403);
  }
  console.log(
    "PASS tanpa kontrak aktif: jumlah sesuai dashboard, status, kontrak berlaku, validasi, dan isolasi organisasi.",
  );
  console.log("PASS filter akun pencatat pegawai: opsi, daftar, dan validasi API.");
} finally {
  await pool.end();
}
