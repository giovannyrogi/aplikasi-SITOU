import assert from "node:assert/strict";
import test from "node:test";
import { getEmployeeAccessFailure, getInactiveAccountMessage } from "../lib/auth/accessPolicy.mjs";

const activeEmployee = {
  role_code: "employee",
  employee_id: "10",
  employee_deleted_at: null,
  employment_status: "active",
  employee_assignment_id: "20",
  employee_location_is_active: true,
  employee_location_is_operational: true,
  employee_unit_is_active: true,
};

test("Admin/HRD tidak mengikuti policy penempatan pegawai", () => {
  assert.equal(getEmployeeAccessFailure({ role_code: "hrd" }), null);
});

test("pegawai dengan lokasi aktif dapat login", () => {
  assert.equal(getEmployeeAccessFailure(activeEmployee), null);
});

test("pegawai ditolak ketika lokasi penempatan dinonaktifkan", () => {
  const failure = getEmployeeAccessFailure({
    ...activeEmployee,
    employee_location_is_active: false,
  });
  assert.equal(failure.code, "EMPLOYEE_LOCATION_INACTIVE");
  assert.match(failure.message, /Admin organisasi Anda/);
});

test("pegawai ditolak ketika divisi penempatan dinonaktifkan", () => {
  const failure = getEmployeeAccessFailure({ ...activeEmployee, employee_unit_is_active: false });
  assert.equal(failure.code, "EMPLOYEE_UNIT_INACTIVE");
});

test("pegawai ditolak ketika tidak memiliki penempatan utama aktif", () => {
  const failure = getEmployeeAccessFailure({ ...activeEmployee, employee_assignment_id: null });
  assert.equal(failure.code, "EMPLOYEE_ASSIGNMENT_INACTIVE");
});

test("pesan akun nonaktif membedakan akun organisasi dan platform", () => {
  assert.match(getInactiveAccountMessage({ role_scope: "organization" }), /Admin organisasi/);
  assert.match(getInactiveAccountMessage({ role_scope: "platform" }), /pengelola sistem SITOU/);
});
