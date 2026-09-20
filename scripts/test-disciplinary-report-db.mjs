import dotenv from "dotenv";
import pg from "pg";
import { normalizeDisciplinaryReportFilters } from "../lib/reports/disciplinaryPolicy.mjs";
import { buildDisciplinaryReportQuery } from "../lib/reports/disciplinaryQuery.mjs";

dotenv.config({ path: process.env.ENV_FILE || ".env.development", quiet: true });

const client = new pg.Client();
await client.connect();
await client.query("BEGIN");

try {
  const base = await client.query(
    `SELECT employee.organization_id,employee.id AS employee_id,user_account.id AS user_id,
      assignment.location_id,action_type.id AS action_type_id,action_type.name AS action_name,
      action_type.duration_value,action_type.duration_unit,action_type.requires_document
     FROM employees employee
     CROSS JOIN LATERAL (SELECT id FROM users ORDER BY id LIMIT 1) user_account
     LEFT JOIN LATERAL (
       SELECT location_id FROM employee_assignments
       WHERE organization_id=employee.organization_id AND employee_id=employee.id
         AND assignment_type='primary' AND effective_from<=current_date
         AND (effective_until IS NULL OR effective_until>=current_date)
       ORDER BY effective_from DESC,id DESC LIMIT 1
     ) assignment ON true
     JOIN disciplinary_action_types action_type
       ON action_type.organization_id=employee.organization_id
       AND action_type.system_key='oral_warning'
     WHERE employee.deleted_at IS NULL ORDER BY employee.id LIMIT 1`,
  );
  if (!base.rows[0]) throw new Error("Pegawai development untuk fixture laporan tidak tersedia.");
  const fixture = base.rows[0];
  const marker = `REPORT-${Date.now()}`;
  const actionIds = [];
  for (const [suffix, issuedDate, status] of [
    ["A", "2026-01-10", "active"],
    ["B", "2026-02-10", "active"],
    ["D", "2026-03-10", "draft"],
  ]) {
    const disciplineCase = await client.query(
      `INSERT INTO discipline_cases
       (organization_id,case_no,employee_id,severity,incident_date,description,status,opened_by_user_id)
       VALUES($1,$2,$3,'light',$4,'Fixture transaksi laporan',$5,$6) RETURNING id`,
      [
        fixture.organization_id,
        `${marker}-${suffix}`,
        fixture.employee_id,
        issuedDate,
        status === "draft" ? "investigating" : "action_issued",
        fixture.user_id,
      ],
    );
    const action = await client.query(
      `INSERT INTO disciplinary_actions
       (organization_id,discipline_case_id,employee_id,action_type_id,action_name_snapshot,
        duration_value_snapshot,duration_unit_snapshot,requires_document_snapshot,
        issued_date,effective_from,effective_until,status,direct_escalation,issued_by_user_id)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,($9::date+interval '3 months')::date,$10,false,$11)
       RETURNING id`,
      [
        fixture.organization_id,
        disciplineCase.rows[0].id,
        fixture.employee_id,
        fixture.action_type_id,
        fixture.action_name,
        fixture.duration_value,
        fixture.duration_unit,
        fixture.requires_document,
        issuedDate,
        status,
        fixture.user_id,
      ],
    );
    actionIds.push(String(action.rows[0].id));
  }

  const query = buildDisciplinaryReportQuery(
    normalizeDisciplinaryReportFilters({ search: marker }),
    String(fixture.organization_id),
    null,
    "2026-09-20",
    11,
  );
  const result = (await client.query(query)).rows[0];
  const row = result.rows[0];
  if (
    result.total !== 1 ||
    row.matched_action_count !== 2 ||
    row.total_official_actions !== 2 ||
    row.action_id !== actionIds[1]
  )
    throw new Error(`Agregasi tindakan resmi tidak sesuai: ${JSON.stringify(result)}`);

  if (fixture.location_id) {
    const denied = await client.query(
      buildDisciplinaryReportQuery(
        normalizeDisciplinaryReportFilters({ search: marker }),
        String(fixture.organization_id),
        ["9223372036854775807"],
        "2026-09-20",
        11,
      ),
    );
    if (denied.rows[0].total !== 0)
      throw new Error("Scope lokasi di luar penempatan masih mengembalikan pegawai.");
  }

  await client.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query.text}`, query.values);
  console.log(
    JSON.stringify({
      ready: true,
      employee_rows: result.total,
      official_actions: row.total_official_actions,
      draft_excluded: true,
      location_scope_checked: Boolean(fixture.location_id),
    }),
  );
} finally {
  await client.query("ROLLBACK").catch(() => {});
  await client.end().catch(() => {});
}
