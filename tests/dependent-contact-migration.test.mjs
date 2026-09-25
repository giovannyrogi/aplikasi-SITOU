import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (relative) => readFileSync(new URL(`../${relative}`, import.meta.url), "utf8");
const migration034 = read("database/migrations/20260925_034_migrate_dependent_contacts.sql");
const migration035 = read("database/migrations/20260925_035_remove_dependent_contact_fields.sql");
const schema = read("sitou_schema_v3.sql");

test("migration kontak keluarga memakai lock, preflight konflik, prioritas, dan primary tunggal", () => {
  assert.match(migration034, /pg_advisory_xact_lock/);
  assert.match(migration034, /phone_multiple_names/);
  assert.match(migration034, /name_multiple_phones/);
  assert.match(migration034, /employee_emergency_contacts/);
  assert.match(migration034, /count\(\*\) = 1/);
  assert.match(migration034, /ignored_by_emergency_contact/);
});

test("migration tahap akhir memverifikasi ulang sebelum menghapus dua kolom lama", () => {
  assert.match(migration035, /_035_conflicts/);
  assert.match(migration035, /DROP CONSTRAINT IF EXISTS ck_employee_dependents_phone_e164/);
  assert.match(migration035, /DROP COLUMN phone/);
  assert.match(migration035, /DROP COLUMN is_emergency_contact/);
});

test("schema bootstrap memusatkan nomor hanya pada kontak darurat", () => {
  const dependentTable = schema.match(
    /CREATE TABLE employee_dependents \([\s\S]*?\n\);/,
  )?.[0];
  const emergencyTable = schema.match(
    /CREATE TABLE employee_emergency_contacts \([\s\S]*?\n\);/,
  )?.[0];
  assert.ok(dependentTable);
  assert.ok(emergencyTable);
  assert.doesNotMatch(dependentTable, /\n\s+phone\s/);
  assert.doesNotMatch(dependentTable, /is_emergency_contact/);
  assert.match(emergencyTable, /phone varchar\(30\) NOT NULL/);
  assert.match(emergencyTable, /is_primary boolean NOT NULL/);
});
