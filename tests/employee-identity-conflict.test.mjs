import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  employeeIdentityConflict,
  employeeIdentityConstraintConflict,
} from "../lib/employees/identityConflict.mjs";

test("constraint NIP menandai hanya field NIP, termasuk NIP ternormalisasi", () => {
  for (const constraint of ["uq_employees_org_number", "uq_employees_org_number_normalized"]) {
    const conflict = employeeIdentityConstraintConflict({ code: "23505", constraint });
    assert.equal(conflict.status, 409);
    assert.deepEqual(Object.keys(conflict.fieldErrors), ["employeeNo"]);
    assert.match(conflict.message, /NIP sudah terdaftar/);
    assert.doesNotMatch(conflict.message, /NIK/);
  }
});

test("constraint NIK menandai hanya NIK KTP tanpa menyebut NIP", () => {
  const conflict = employeeIdentityConstraintConflict({
    code: "23505",
    constraint: "uq_employees_org_nik",
  });
  assert.deepEqual(Object.keys(conflict.fieldErrors), ["nationalId"]);
  assert.match(conflict.message, /NIK KTP sudah terdaftar/);
  assert.doesNotMatch(conflict.message, /NIP/);
});

test("dua identitas duplikat mendapatkan pesan dan field terpisah", () => {
  const conflict = employeeIdentityConflict({ employeeNo: true, nationalId: true });
  assert.deepEqual(Object.keys(conflict.fieldErrors), ["employeeNo", "nationalId"]);
  assert.match(conflict.message, /NIP sudah terdaftar/);
  assert.match(conflict.message, /NIK KTP sudah terdaftar/);
  assert.doesNotMatch(conflict.message, /NIP atau NIK/);
  assert.equal(employeeIdentityConflict(), null);
});

test("error lain tidak dikira duplikat identitas; constraint mengikuti schema", () => {
  assert.equal(
    employeeIdentityConstraintConflict({
      code: "23505",
      constraint: "uq_employee_highest_education",
    }),
    null,
  );
  assert.equal(
    employeeIdentityConstraintConflict({ code: "42703", constraint: "uq_employees_org_nik" }),
    null,
  );
  const schema = readFileSync(new URL("../sitou_schema_v3.sql", import.meta.url), "utf8");
  for (const constraint of [
    "uq_employees_org_number",
    "uq_employees_org_number_normalized",
    "uq_employees_org_nik",
  ])
    assert.ok(schema.includes(constraint));
});
