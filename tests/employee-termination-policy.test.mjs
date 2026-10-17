import assert from "node:assert/strict";
import test from "node:test";
import { validateEmployeeTermination } from "../lib/employees/terminationPolicy.mjs";

test("pengakhiran menerima tanggal hari ini setelah tanggal bergabung", () => {
  assert.equal(
    validateEmployeeTermination({
      currentStatus: "active",
      joinedDate: "2025-01-01",
      terminationDate: "2026-08-28",
      today: "2026-08-28",
    }),
    null,
  );
});

test("pengakhiran menolak pegawai yang lifecycle-nya sudah final", () => {
  assert.equal(
    validateEmployeeTermination({
      currentStatus: "retired",
      joinedDate: "2020-01-01",
      terminationDate: "2026-08-28",
      today: "2026-08-28",
    })?.code,
    "EMPLOYEE_ALREADY_TERMINATED",
  );
});

test("pengakhiran menolak tanggal sebelum pegawai bergabung", () => {
  assert.equal(
    validateEmployeeTermination({
      currentStatus: "active",
      joinedDate: "2026-01-10",
      terminationDate: "2026-01-09",
      today: "2026-08-28",
    })?.code,
    "TERMINATION_BEFORE_JOINED_DATE",
  );
});

test("pengakhiran menolak tanggal masa depan", () => {
  assert.equal(
    validateEmployeeTermination({
      currentStatus: "active",
      joinedDate: "2026-01-10",
      terminationDate: "2026-08-29",
      today: "2026-08-28",
    })?.code,
    "TERMINATION_DATE_IN_FUTURE",
  );
});
