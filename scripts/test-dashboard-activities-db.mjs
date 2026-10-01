import assert from "node:assert/strict";
import dotenv from "dotenv";
import pg from "pg";
import { ORGANIZATION_ACTIVITY_SQL } from "../lib/dashboard/activityQuery.mjs";
import {
  ORGANIZATION_ACTIVITY_ACTIONS,
  formatDashboardActivitySubject,
} from "../lib/dashboard/config.mjs";

dotenv.config({ path: ".env.development", quiet: true });
const client = new pg.Client({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  connectionTimeoutMillis: 5000,
});

// Tabel sementara menguji SQL sebenarnya tanpa menulis data bisnis development.
try {
  await client.connect();
  // EXPLAIN memeriksa schema nyata secara read-only tanpa mencetak identitas pegawai.
  const organization = await client.query("SELECT id FROM organizations ORDER BY id LIMIT 1");
  const plan = await client.query(
    `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${ORGANIZATION_ACTIVITY_SQL}`,
    [organization.rows[0]?.id || 0, null, ORGANIZATION_ACTIVITY_ACTIONS],
  );
  console.log(
    `Query aktivitas pada schema development: ${plan.rows[0]["QUERY PLAN"][0]["Execution Time"]} ms.`,
  );
  await client.query("BEGIN");
  await client.query(`
    CREATE TEMP TABLE organizations(id bigint,timezone text);
    CREATE TEMP TABLE users(id bigint,username text);
    CREATE TEMP TABLE roles(id bigint,code text);
    CREATE TEMP TABLE user_organization_roles(user_id bigint,organization_id bigint,
      role_id bigint,active_from timestamptz,active_until timestamptz);
    CREATE TEMP TABLE employees(id bigint,organization_id bigint,full_name text,employee_no text);
    CREATE TEMP TABLE audit_logs(id bigint,organization_id bigint,actor_user_id bigint,
      action text,entity_type text,entity_id text,occurred_at timestamptz,
      after_data jsonb,before_data jsonb);
    CREATE TEMP TABLE employment_contracts(id bigint,organization_id bigint,employee_id bigint);
    CREATE TEMP TABLE employee_assignments(id bigint,organization_id bigint,employee_id bigint,
      assignment_type text,effective_from date,effective_until date,location_id bigint);
    CREATE TEMP TABLE leave_requests(id bigint,organization_id bigint,employee_id bigint);
    CREATE TEMP TABLE leave_entitlements(id bigint,organization_id bigint,employee_id bigint);
    CREATE TEMP TABLE discipline_cases(id bigint,organization_id bigint,employee_id bigint);
    CREATE TEMP TABLE disciplinary_actions(id bigint,organization_id bigint,employee_id bigint,
      discipline_case_id bigint,status text);
    INSERT INTO organizations VALUES (1,'Asia/Makassar'),(2,'Asia/Jakarta');
    INSERT INTO users VALUES (1,'adminsalsa'),(2,'adminlain'),(3,'platform');
    INSERT INTO roles VALUES (1,'hrd'),(2,'superadmin');
    INSERT INTO user_organization_roles VALUES
      (1,1,1,now()-interval '1 year',NULL),(2,2,1,now()-interval '1 year',NULL),
      (3,NULL,2,now()-interval '1 year',NULL),(3,1,1,now()-interval '1 year',NULL);
    INSERT INTO employees VALUES (11,1,'Pegawai A','001'),(12,1,'Pegawai B','002'),
      (21,2,'Pegawai Organisasi Lain','003');
    INSERT INTO employee_assignments VALUES
      (1,1,11,'primary',current_date-1,NULL,101),(2,1,12,'primary',current_date-1,NULL,102);
    INSERT INTO employment_contracts VALUES (31,1,11);
    INSERT INTO disciplinary_actions VALUES (41,1,11,51,'draft');
    INSERT INTO audit_logs(id,organization_id,actor_user_id,action,entity_type,entity_id,occurred_at) VALUES
      (1,1,1,'employee.create','employee','11',now()),
      (2,2,2,'employee.create','employee','21',now()),
      (3,1,3,'employee.update','employee','11',now()),
      (4,1,1,'employee.update','employee','12',now()),
      (5,1,1,'employment_contract.correct','employment_contract','31',now()),
      (6,1,1,'employee_draft.create','employee_onboarding_draft','99',now()),
      (7,1,1,'disciplinary_action.update','disciplinary_action','41',now()),
      (8,1,2,'employee.update','employee','11',now());
  `);
  const all = await client.query(ORGANIZATION_ACTIVITY_SQL, [
    1,
    null,
    ORGANIZATION_ACTIVITY_ACTIONS,
  ]);
  assert.deepEqual(
    all.rows.map((row) => row.id),
    ["5", "4", "1"],
  );
  assert.equal(all.rows[0].employee_name, "Pegawai A");
  assert.equal(all.rows[0].employee_no, "001");
  assert.equal(all.rows[0].actor_name, "@adminsalsa");
  const scoped = await client.query(ORGANIZATION_ACTIVITY_SQL, [
    1,
    [101],
    ORGANIZATION_ACTIVITY_ACTIONS,
  ]);
  assert.deepEqual(
    scoped.rows.map((row) => row.id),
    ["5", "1"],
  );
  assert.equal(
    (await client.query(ORGANIZATION_ACTIVITY_SQL, [1, [], ORGANIZATION_ACTIVITY_ACTIONS]))
      .rowCount,
    0,
  );
  assert.deepEqual(
    (
      await client.query(ORGANIZATION_ACTIVITY_SQL, [2, null, ORGANIZATION_ACTIVITY_ACTIONS])
    ).rows.map((row) => row.id),
    ["2"],
  );
  await client.query(`INSERT INTO audit_logs VALUES
    (9,1,1,'login.success','user','1',now(),NULL,NULL),
    (10,1,1,'unknown.action','user','1',now(),NULL,NULL),
    (11,1,1,'organization_account.update','user','2',now(),NULL,NULL),
    (12,1,1,'location.update','location','101',now(),'{"name":"Kantor Pusat"}',NULL),
    (13,1,1,'report.export','report','expiring-contracts',now(),NULL,NULL);`);
  const details = await client.query(ORGANIZATION_ACTIVITY_SQL, [
    1,
    null,
    ORGANIZATION_ACTIVITY_ACTIONS,
  ]);
  assert.equal(
    details.rows.some((row) => row.id === "10"),
    false,
  );
  assert.equal(
    formatDashboardActivitySubject(details.rows.find((row) => row.id === "9")),
    "Akun: @adminsalsa",
  );
  assert.equal(
    formatDashboardActivitySubject(details.rows.find((row) => row.id === "11")),
    "Akun: belum tersedia",
  );
  assert.equal(
    formatDashboardActivitySubject(details.rows.find((row) => row.id === "12")),
    "Lokasi: Kantor Pusat",
  );
  assert.equal(
    formatDashboardActivitySubject(details.rows.find((row) => row.id === "13")),
    "Laporan: Kontrak Akan Berakhir",
  );
  console.log(
    "Aktivitas dashboard: organisasi, pelaku, Superadmin, scope, draft, dan target terverifikasi.",
  );
} finally {
  await client.query("ROLLBACK").catch(() => {});
  await client.end();
}
