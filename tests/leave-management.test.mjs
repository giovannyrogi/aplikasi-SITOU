import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { leaveAdjustmentSchema, leaveRequestCreateSchema, leaveTypeCreateSchema } from "../lib/leave/schemas.js";

test("jenis bersaldo wajib memiliki jatah tahunan", () => {
  const result = leaveTypeCreateSchema.safeParse({
    organizationId: 1,
    name: "Cuti tahunan",
    category: "leave",
    unit: "day",
    requiresAttachment: false,
    usesBalance: true,
    annualAllowance: null,
    isActive: true,
  });
  assert.equal(result.success, false);
  assert.equal(result.error.issues[0].path.join("."), "annualAllowance");
});

test("jatah tahunan hanya menerima angka bulat minimal satu", () => {
  const base = {
    organizationId: 1,
    name: "Cuti tahunan",
    category: "leave",
    unit: "day",
    requiresAttachment: false,
    usesBalance: true,
    isActive: true,
  };
  assert.equal(leaveTypeCreateSchema.safeParse({ ...base, annualAllowance: 12 }).success, true);
  assert.equal(leaveTypeCreateSchema.safeParse({ ...base, annualAllowance: 2.5 }).success, false);
  assert.equal(leaveTypeCreateSchema.safeParse({ ...base, annualAllowance: 0 }).success, false);
});

test("pencatatan HRD menerima periode, durasi, alasan, dan lampiran", () => {
  const result = leaveRequestCreateSchema.safeParse({
    organizationId: 1,
    employeeId: 2,
    leaveTypeId: 3,
    startDate: "2026-09-01",
    endDate: "2026-09-02",
    requestedUnits: 2,
    reason: "Keperluan keluarga yang telah dikonfirmasi.",
    attachmentFileIds: [4],
  });
  assert.equal(result.success, true);
});

test("durasi dan penyesuaian saldo menolak angka desimal", () => {
  const request = leaveRequestCreateSchema.safeParse({
    organizationId: 1,
    employeeId: 2,
    leaveTypeId: 3,
    startDate: "2026-09-01",
    endDate: "2026-09-01",
    requestedUnits: 0.5,
    reason: "Keperluan keluarga yang telah dikonfirmasi.",
    attachmentFileIds: [],
  });
  const adjustment = leaveAdjustmentSchema.safeParse({
    organizationId: 1,
    transactionType: "adjustment",
    units: 1.5,
    reason: "Penyesuaian berdasarkan kebijakan organisasi.",
  });
  assert.equal(request.success, false);
  assert.equal(adjustment.success, false);
});

test("penyesuaian saldo menolak nilai nol dan alasan pendek", () => {
  const result = leaveAdjustmentSchema.safeParse({
    organizationId: 1,
    transactionType: "adjustment",
    units: 0,
    reason: "pendek",
  });
  assert.equal(result.success, false);
});

test("migration dan schema bootstrap memisahkan cuti dari status pegawai", async () => {
  const [migration, integerMigration, schema] = await Promise.all([
    readFile(new URL("../database/migrations/20260901_022_leave_management.sql", import.meta.url), "utf8"),
    readFile(
      new URL("../database/migrations/20260901_024_integer_leave_units.sql", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../sitou_schema_v3.sql", import.meta.url), "utf8"),
  ]);
  assert.match(migration, /employee\.leave_status_normalized/);
  assert.match(migration, /CREATE TABLE leave_entitlements/);
  assert.match(migration, /CREATE TABLE leave_balance_transactions/);
  assert.doesNotMatch(schema, /employment_status IN \([^)]*'leave'/);
  assert.match(schema, /'leave_requests\.manage'/);
  assert.match(integerMigration, /annual_allowance TYPE integer/);
  assert.match(integerMigration, /requested_units TYPE integer/);
  assert.match(integerMigration, /units TYPE integer/);
  assert.match(integerMigration, /RAISE EXCEPTION/);
  assert.match(schema, /annual_allowance integer/);
  assert.match(schema, /requested_units integer/);
  assert.match(schema, /units integer NOT NULL CHECK \(units<>0\)/);
});

test("daftar cuti memakai section filter utama tanpa drawer dan toolbar lama", async () => {
  const [page, section] = await Promise.all([
    readFile(new URL("../app/(protected)/leave-requests/page.jsx", import.meta.url), "utf8"),
    readFile(
      new URL("../app/components/filters/OperationalFilterSection.jsx", import.meta.url),
      "utf8",
    ),
  ]);
  assert.match(page, /<OperationalFilterSection/);
  assert.match(page, /startOf\("month"\)/);
  assert.match(page, /label: "Pegawai"/);
  assert.match(page, /label: "Lokasi"/);
  assert.match(page, /label: "Divisi & Unit"/);
  assert.match(page, /label: "Status"/);
  assert.match(page, /options=\{references\.locations\}/);
  assert.match(page, /showEmployeeNumber=\{false\}/);
  assert.match(page, /showCode=\{false\}/);
  assert.doesNotMatch(page, /<Drawer|Muat ulang|Semua periode/);
  assert.match(section, /gridTemplateColumns/);
});

test("form cuti menyusun komponen upload reusable untuk banyak lampiran", async () => {
  const [form, uploadList] = await Promise.all([
    readFile(new URL("../app/components/leave/LeaveRequestForm.jsx", import.meta.url), "utf8"),
    readFile(
      new URL("../app/components/forms/FileUploadListField.jsx", import.meta.url),
      "utf8",
    ),
  ]);
  assert.match(form, /<FileUploadListField/);
  assert.doesNotMatch(form, /Upload\.Dragger/);
  assert.match(form, /required=\{Boolean\(selectedType\?\.requires_attachment\)\}/);
  assert.match(form, /name="attachmentFiles"/);
  assert.match(form, /fullWidth/);
  assert.match(form, /const onErrorRef = useRef\(onError\)/);
  assert.doesNotMatch(form, /\[form, onError, open/);
  assert.match(uploadList, /<FileUploadField/);
});
