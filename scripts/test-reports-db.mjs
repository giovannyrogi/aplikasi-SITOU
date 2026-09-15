import assert from "node:assert/strict";
import dotenv from "dotenv";
import pg from "pg";
import { buildReportQuery } from "../lib/reports/query.mjs";
import { normalizeReportFilters } from "../lib/reports/policy.mjs";
dotenv.config({ path: ".env.development", quiet: true });
const client = new pg.Client({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
});
await client.connect();
try {
  await client.query("BEGIN");
  // Tabel sementara menutupi tabel asli hanya pada koneksi QA; seluruh fixture dibuang saat rollback.
  await client.query(`CREATE TEMP TABLE employees(id bigint,organization_id bigint,employee_no text,full_name text,birth_date date,joined_date date,employment_status text,deleted_at timestamptz);
    CREATE TEMP TABLE employee_assignments(id bigint,organization_id bigint,employee_id bigint,location_id bigint,organization_unit_id bigint,position_id bigint,assignment_type text,effective_from date,effective_until date);
    CREATE TEMP TABLE locations(id bigint,organization_id bigint,name text);
    CREATE TEMP TABLE organization_units(id bigint,organization_id bigint,name text);
    CREATE TEMP TABLE positions(id bigint,organization_id bigint,name text);
    CREATE TEMP TABLE employment_types(id bigint,organization_id bigint,name text);
    CREATE TEMP TABLE employment_contracts(id bigint,organization_id bigint,employee_id bigint,employment_type_id bigint,contract_no text,start_date date,end_date date,status text);
    INSERT INTO employees VALUES
      (1,1,'001','Uji A','1968-09-11','2020-01-01','active',NULL),
      (2,1,'002','Uji B','1968-02-29','2020-01-01','probation',NULL),
      (3,1,'003','Uji C',NULL,'2020-01-01','active',NULL),
      (4,1,'004','Uji D','2028-01-01','2020-01-01','active',NULL),
      (5,1,'005','Uji E','1969-09-11','2020-01-01','suspended',NULL),
      (6,1,'006','Uji F','1968-09-11','2020-01-01','retired',NULL),
      (7,2,'007','Uji G','1968-09-11','2020-01-01','active',NULL),
      (8,1,'008','Uji H','1968-09-11','2020-01-01','active',now());
    INSERT INTO locations VALUES(1,1,'Lokasi A');
    INSERT INTO organization_units VALUES(1,1,'Unit A');
    INSERT INTO positions VALUES(1,1,'Jabatan A');
    INSERT INTO employment_types VALUES(1,1,'Jenis A');
    INSERT INTO employee_assignments VALUES(1,1,1,1,1,1,'primary','2020-01-01',NULL);
    INSERT INTO employment_contracts VALUES
      (1,1,1,1,'C1','2025-01-01','2026-09-11','renewed'),
      (2,1,1,1,'C2','2026-09-12','2027-09-11','active'),
      (3,1,2,1,'C3','2025-01-01','2026-08-01','expired'),
      (4,1,3,1,'C4','2025-01-01',NULL,'active'),
      (5,1,4,1,'C5','2025-01-01','2026-10-01','cancelled'),
      (6,1,5,1,'C6','2025-01-01','2026-01-01','renewed'),
      (7,1,5,1,'C7','2026-01-02','2026-10-11','active'),
      (8,2,7,1,'C8','2025-01-01','2026-09-11','active'),
      (9,1,1,1,'C9','2024-01-01','2024-12-31','renewed'),
      (10,1,3,1,'C10','2025-01-01','2026-10-01','draft');`);
  await client.query(`ALTER TABLE employees ADD COLUMN profile_photo_file_id bigint;
    CREATE TEMP TABLE stored_files(id bigint, organization_id bigint, deleted_at timestamptz);
    INSERT INTO stored_files VALUES (101,1,NULL),(102,1,now()),(103,2,NULL);
    UPDATE employees SET profile_photo_file_id=101 WHERE id=1;
    UPDATE employees SET profile_photo_file_id=102 WHERE id=2;
    UPDATE employees SET profile_photo_file_id=103 WHERE id=5;`);
  const read = async (kind, input = {}, scope = null, limit = 100, cursor = null, age = 58) =>
    (
      await client.query(
        buildReportQuery(
          kind,
          normalizeReportFilters(kind, input, "2026-09-11"),
          "1",
          scope,
          "2026-09-11",
          limit,
          cursor,
          age,
        ),
      )
    ).rows[0];
  let result = await read("retirements");
  const laterPolicy = await read("retirements", {}, null, 100, null, 60);
  assert.equal(laterPolicy.total, 0, "Usia 60 tahun menggeser proyeksi, tanpa fallback ke 58");
  assert.deepEqual(
    result.rows.map((r) => r.employee_id),
    ["1", "5"],
  );
  assert.equal(result.rows[0].days_remaining, 0);
  assert.equal(result.rows[0].organization_id, "1");
  assert.equal(result.rows[0].profile_photo_file_id, "101");
  assert.equal(result.rows[1].profile_photo_file_id, null);
  result = await read("retirements", { group: "overdue" });
  assert.equal(result.rows[0].due_date, "2026-02-28");
  assert.equal(result.rows[0].profile_photo_file_id, null);
  result = await read("retirements", { group: "invalid" });
  assert.equal(result.total, 2);
  assert.equal((await read("retirements", {}, [])).total, 0);
  assert.equal((await read("retirements", {}, [1])).total, 1);
  result = await read("expiring-contracts");
  assert.deepEqual(
    result.rows.map((r) => r.id),
    ["1", "7"],
  );
  assert.equal(result.rows[0].successor_id, "2");
  assert.equal((await read("expiring-contracts", { group: "overdue" })).total, 1);
  assert.equal((await read("expiring-contracts", { successor: "yes" })).total, 1);
  assert.equal((await read("expiring-contracts", { successor: "no" })).total, 1);
  const first = await read("retirements", {}, null, 1);
  assert.equal(first.row_offset, 0);
  const last = first.rows[0];
  const next = await read("retirements", {}, null, 1, { date: last.due_date, id: last.id });
  assert.equal(next.rows[0].id, "5");
  assert.equal(next.row_offset, 1);
  const plan = buildReportQuery(
    "retirements",
    normalizeReportFilters("retirements", {}, "2026-09-11"),
    "1",
    null,
    "2026-09-11",
    20,
    null,
    58,
  );
  await client.query({ text: `EXPLAIN (ANALYZE, BUFFERS) ${plan.text}`, values: plan.values });
  // Volume sintetis: total tidak dipotong ketika halaman/ekspor dibatasi.
  await client.query(`INSERT INTO employees
    SELECT n,1,'QA-'||n,'Pegawai Uji '||n,DATE '1968-09-11',DATE '2020-01-01','active',NULL
    FROM generate_series(100,10100) n`);
  const bulk = await read("retirements", {}, null, 5001);
  assert.equal(bulk.total, 10003);
  assert.equal(bulk.rows.length, 5001);
  assert.deepEqual(
    bulk.rows.slice(0, 3).map((row) => row.id),
    ["1", "100", "101"],
  );
  await client.query({ text: `EXPLAIN (ANALYZE, BUFFERS) ${plan.text}`, values: plan.values });
  console.log(
    "PASS laporan: periode, kabisat, final, organisasi, scope kosong/terpilih, kontrak lanjutan, keyset, query plan sintetis.",
  );
} finally {
  await client.query("ROLLBACK");
  await client.end();
}
