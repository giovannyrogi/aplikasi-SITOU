import assert from "node:assert/strict";
import test from "node:test";
import {
  EMPLOYEE_COMPLETENESS_OPTIONS,
  getEmployeeCompletenessOption,
} from "../lib/employees/completenessOptions.js";
import { employeeCompletenessSql } from "../lib/employees/completeness.js";
import { parseEmployeeListFilters } from "../lib/employees/schemas.js";

test("daftar dan export menerima setiap pilihan kelengkapan yang sama", () => {
  for (const option of EMPLOYEE_COMPLETENESS_OPTIONS) {
    const parsed = parseEmployeeListFilters(new URLSearchParams({ completeness: option.value }));
    assert.equal(parsed.success, true);
    assert.equal(parsed.data.completeness, option.value);
    assert.equal(typeof employeeCompletenessSql("employee", option.value), "string");
    assert.equal(getEmployeeCompletenessOption(option.value).label, option.label);
  }
});

test("filter kelengkapan tidak menerima input SQL atau pilihan tidak dikenal", () => {
  assert.equal(
    parseEmployeeListFilters(new URLSearchParams({ completeness: "injected" })).success,
    false,
  );
  assert.throws(() => employeeCompletenessSql("employee", "injected"), /tidak valid/);
  assert.throws(
    () => employeeCompletenessSql("employee; DROP TABLE employees", "missing_kk"),
    /tidak valid/,
  );
});

test("filter default menampilkan semua pegawai dan pilihan umum lama tidak tersedia", () => {
  const parsed = parseEmployeeListFilters(new URLSearchParams());
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.completeness, "all");
  assert.equal(getEmployeeCompletenessOption("all").label, "Semua pegawai");
  assert.equal(employeeCompletenessSql("employee", "all"), "TRUE");
  for (const value of ["complete", "incomplete"]) {
    assert.equal(getEmployeeCompletenessOption(value), undefined);
    assert.equal(
      parseEmployeeListFilters(new URLSearchParams({ completeness: value })).success,
      false,
    );
  }
});
