import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config({ path: ".env.development", quiet: true });

const client = new pg.Client({
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  port: Number(process.env.PGPORT || 5432),
});
const schemaName = `test_dependent_contacts_${randomUUID().replaceAll("-", "")}`;
const quotedSchema = `"${schemaName}"`;
const migration034 = await readFile(
  new URL("../database/migrations/20260925_034_migrate_dependent_contacts.sql", import.meta.url),
  "utf8",
);
const migration035 = await readFile(
  new URL("../database/migrations/20260925_035_remove_dependent_contact_fields.sql", import.meta.url),
  "utf8",
);

try {
  await client.connect();
  await client.query(`CREATE SCHEMA ${quotedSchema}`);
  await client.query(`SET search_path TO ${quotedSchema}, public`);
  await client.query(`
    CREATE TABLE organizations(id bigint PRIMARY KEY);
    CREATE TABLE employees(id bigint PRIMARY KEY, organization_id bigint NOT NULL);
    CREATE TABLE employee_dependents(
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      organization_id bigint NOT NULL,
      employee_id bigint NOT NULL,
      relationship varchar(30) NOT NULL,
      full_name varchar(200) NOT NULL,
      birth_date date,
      national_id varchar(30),
      phone varchar(30),
      is_dependent boolean NOT NULL DEFAULT true,
      is_emergency_contact boolean NOT NULL DEFAULT false,
      notes text,
      CONSTRAINT ck_employee_dependents_phone_e164
        CHECK (phone IS NULL OR phone ~ '^\\+628[1-9][0-9]{7,10}$')
    );
    CREATE TABLE employee_emergency_contacts(
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      organization_id bigint NOT NULL,
      employee_id bigint NOT NULL,
      full_name varchar(200) NOT NULL,
      relationship varchar(50),
      phone varchar(30) NOT NULL,
      address text,
      is_primary boolean NOT NULL DEFAULT false
    );
    CREATE UNIQUE INDEX uq_employee_primary_emergency_contact
      ON employee_emergency_contacts(employee_id) WHERE is_primary;
  `);
  await client.query(`
    INSERT INTO organizations(id) VALUES (1);
    INSERT INTO employees(id,organization_id) VALUES (1,1),(2,1),(3,1);
    INSERT INTO employee_dependents(
      organization_id,employee_id,relationship,full_name,phone,is_emergency_contact
    ) VALUES
      (1,1,'wife','Kontak Baru','+628111111111',false),
      (1,2,'child','Nama Sama','+628222222222',true),
      (1,3,'father','Nama Pertama','+628444444444',true),
      (1,3,'mother','Nama Kedua','+628444444444',false);
    INSERT INTO employee_emergency_contacts(
      organization_id,employee_id,full_name,relationship,phone,is_primary
    ) VALUES (1,2,'Nama-Sama','Anak','+628333333333',false);
  `);

  await assert.rejects(client.query(migration034), /Migrasi kontak keluarga dibatalkan/);
  await client.query("ROLLBACK");
  assert.equal(
    Number((await client.query("SELECT count(*) AS count FROM employee_emergency_contacts")).rows[0].count),
    1,
    "rollback konflik tidak boleh menyisakan kontak baru",
  );

  await client.query("DELETE FROM employee_dependents WHERE employee_id=3");
  await client.query(migration034);

  const contacts = await client.query(`
    SELECT employee_id,full_name,relationship,phone,is_primary
    FROM employee_emergency_contacts
    ORDER BY employee_id,id
  `);
  assert.deepEqual(contacts.rows, [
    {
      employee_id: "1",
      full_name: "Kontak Baru",
      relationship: "Istri",
      phone: "+628111111111",
      is_primary: true,
    },
    {
      employee_id: "2",
      full_name: "Nama-Sama",
      relationship: "Anak",
      phone: "+628333333333",
      is_primary: true,
    },
  ]);

  await client.query(migration034);
  assert.equal(
    Number((await client.query("SELECT count(*) AS count FROM employee_emergency_contacts")).rows[0].count),
    2,
    "migration 034 harus idempotent",
  );

  await client.query(migration035);
  const removedColumns = await client.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema=$1 AND table_name='employee_dependents'
       AND column_name IN ('phone','is_emergency_contact')`,
    [schemaName],
  );
  assert.equal(removedColumns.rowCount, 0);
  console.log("Migration kontak keluarga: konflik rollback, pemindahan, prioritas, primary, dan drop terverifikasi.");
} finally {
  await client.query("ROLLBACK").catch(() => {});
  await client.query("RESET search_path").catch(() => {});
  await client.query(`DROP SCHEMA IF EXISTS ${quotedSchema} CASCADE`).catch(() => {});
  await client.end().catch(() => {});
}
