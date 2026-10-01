import assert from "node:assert/strict";
import dotenv from "dotenv";
import pg from "pg";
import { employeeCompletenessSql } from "../lib/employees/completeness.js";
import { EMPLOYEE_COMPLETENESS_OPTIONS } from "../lib/employees/completenessOptions.js";

dotenv.config({ path: ".env.development", quiet: true });
const client = new pg.Client({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  connectionTimeoutMillis: 5000,
});

// Semua fixture berada pada tabel sementara; data bisnis asli hanya dibaca lewat EXPLAIN.
try {
  await client.connect();
  const organization = await client.query("SELECT id FROM organizations ORDER BY id LIMIT 1");
  for (const { value } of EMPLOYEE_COMPLETENESS_OPTIONS) {
    await client.query(
      `EXPLAIN (ANALYZE, BUFFERS) SELECT count(*) FROM employees employee
      WHERE employee.organization_id=$1 AND (${employeeCompletenessSql("employee", value)})`,
      [organization.rows[0]?.id || 0],
    );
  }
  await client.query("BEGIN");
  await client.query(`
    CREATE TEMP TABLE employees(id bigint,organization_id bigint,national_id text,profile_photo_file_id bigint);
    CREATE TEMP TABLE employee_identifiers(organization_id bigint,employee_id bigint,identifier_type text,
      identifier_value text,document_file_id bigint);
    CREATE TEMP TABLE stored_files(id bigint,organization_id bigint,deleted_at timestamptz);
    CREATE TEMP TABLE employee_documents(organization_id bigint,employee_id bigint,document_type text,file_id bigint);
    CREATE TEMP TABLE employee_contacts(organization_id bigint,employee_id bigint,whatsapp text,
      ktp_address text,domicile_address text);
    CREATE TEMP TABLE employee_bank_accounts(organization_id bigint,employee_id bigint,bank_name text,
      account_number text,account_holder text);
    CREATE TEMP TABLE employee_emergency_contacts(organization_id bigint,employee_id bigint,full_name text,phone text);
    CREATE TEMP TABLE employee_educations(organization_id bigint,employee_id bigint,education_level text,
      is_highest boolean,certificate_file_id bigint);
    CREATE TEMP TABLE employee_assignments(organization_id bigint,employee_id bigint,assignment_type text,
      effective_from date,effective_until date);
    INSERT INTO employees SELECT id,1,CASE WHEN id IN (2,4,5,6,7,8) THEN '7171082102940001' END,
      CASE WHEN id=4 THEN 100 WHEN id=5 THEN 105 END FROM generate_series(1,8) id;
    INSERT INTO employees VALUES (21,2,'7171082102940002',200);
    INSERT INTO stored_files VALUES (100,1,NULL),(105,1,now()),(200,2,NULL);
    INSERT INTO employee_contacts VALUES (1,4,'+628123456789','Alamat KTP','Alamat domisili'),
      (1,2,' ',NULL,NULL),(1,5,'+628123456789','Alamat KTP',NULL),(2,7,'+628123456789','Alamat KTP','Domisili');
    INSERT INTO employee_bank_accounts VALUES (1,4,'Bank Contoh','001','Nama Contoh'),(2,7,'Bank Lain','002','Nama Lain');
    INSERT INTO employee_emergency_contacts VALUES (1,4,'Kontak Contoh','+628123456789'),(2,7,'Kontak Lain','+628123456789');
    INSERT INTO employee_educations VALUES (1,3,'Tidak/Belum Tamat SD',true,NULL),
      (1,5,'Tidak/Belum Pernah Sekolah',true,NULL),(1,4,'SMA',true,NULL),
      (1,6,'S1',true,100),(1,7,'SD',true,105);
    INSERT INTO employee_assignments VALUES (1,4,'primary',current_date-1,NULL);
  `);
  for (const [identifierType, documentType] of [
    ["family_card", "kk"],
    ["tax_npwp", "npwp"],
    ["bpjs_health", "bpjs_health"],
    ["bpjs_employment", "bpjs_employment"],
  ]) {
    await client.query(
      `INSERT INTO employee_identifiers VALUES
      (1,2,$1,'123',NULL),(1,4,$1,'123',100),(1,5,$1,'123',NULL),
      (1,6,$1,'123',105),(1,7,$1,'123',200),
      (1,8,$1,'',100),(1,8,$1,'123',NULL),(2,7,$1,'123',200)`,
      [identifierType],
    );
    await client.query(
      `INSERT INTO employee_documents VALUES (1,3,$1,100),(1,5,$1,100),
      (2,7,$1,200)`,
      [documentType],
    );
  }
  await client.query(`INSERT INTO employee_documents VALUES
    (1,3,'ktp',100),(1,4,'ktp',100),(1,5,'ktp',100),(1,6,'ktp',105),
    (1,8,'ktp',100),(2,7,'ktp',200);`);
  const expected = {
    missing_kk: [1, 2, 3, 6, 7],
    missing_npwp: [1, 2, 3, 6, 7],
    missing_bpjs_health: [1, 2, 3, 6, 7],
    missing_bpjs_employment: [1, 2, 3, 6, 7],
    missing_ktp: [1, 2, 3, 6, 7],
    missing_photo: [1, 2, 3, 5, 6, 7, 8],
    missing_whatsapp: [1, 2, 3, 6, 7, 8],
    missing_address: [1, 2, 3, 5, 6, 7, 8],
    missing_bank_account: [1, 2, 3, 5, 6, 7, 8],
    missing_emergency_contact: [1, 2, 3, 5, 6, 7, 8],
    missing_education: [1, 2, 8],
    missing_diploma: [4, 7],
    all: [1, 2, 3, 4, 5, 6, 7, 8],
  };
  for (const { value } of EMPLOYEE_COMPLETENESS_OPTIONS) {
    const rows = await client.query(
      `SELECT employee.id::int FROM employees employee
      WHERE employee.organization_id=$1 AND (${employeeCompletenessSql("employee", value)}) ORDER BY employee.id`,
      [1],
    );
    assert.deepEqual(
      rows.rows.map((row) => row.id),
      expected[value],
      value,
    );
  }
  console.log(
    "Filter kelengkapan: nomor/foto terpisah, dokumen lama, file terhapus, pendidikan khusus, dan isolasi organisasi lulus.",
  );
} finally {
  await client.query("ROLLBACK").catch(() => {});
  await client.end();
}
