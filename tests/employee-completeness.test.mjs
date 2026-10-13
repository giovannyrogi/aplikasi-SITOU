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


test("golongan darah daftar dan export mengikuti pilihan form", () => {
  for(const bloodType of ["A","B","AB","O"]) {
    const parsed=parseEmployeeListFilters(new URLSearchParams({bloodType}));
    assert.equal(parsed.success,true);assert.equal(parsed.data.bloodType,bloodType);
  }
  assert.equal(parseEmployeeListFilters(new URLSearchParams()).data.bloodType,null);
  assert.equal(parseEmployeeListFilters(new URLSearchParams({bloodType:"UNKNOWN"})).success,false);
});
test("tanpa penempatan memakai status Dashboard dan periode penempatan utama", () => {
  const sql=employeeCompletenessSql("employee","without_assignment");
  assert.match(sql,/employment_status IN \('active','probation'\)/);
  assert.match(sql,/assignment_type='primary'/);assert.match(sql,/effective_from<=current_date/);assert.match(sql,/effective_until>=current_date/);
});
