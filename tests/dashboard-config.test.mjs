import assert from "node:assert/strict";
import test from "node:test";
import {
  buildEmployeeSummary,
  DASHBOARD_PERIODS,
  formatDisciplineSeverity,
  formatDashboardActivity,
  formatSubscriptionStatus,
  normalizeDashboardPeriod,
  normalizeDashboardRange,
} from "../lib/dashboard/config.mjs";

test("periode dashboard hanya menerima pilihan yang disediakan", () => {
  assert.equal(normalizeDashboardPeriod("6m"), "6m");
  assert.equal(normalizeDashboardPeriod("24m"), "24m");
  assert.equal(normalizeDashboardPeriod("36m"), "12m");
  assert.deepEqual(DASHBOARD_PERIODS, { "6m": 6, "12m": 12, "24m": 24 });
});

test("aktivitas audit diterjemahkan tanpa mengekspos payload", () => {
  assert.equal(formatDashboardActivity("employee.create", "employee"), "Menambahkan data pegawai");
  assert.equal(
    formatDashboardActivity("contract.update", "employment_contract"),
    "Memperbarui kontrak kerja",
  );
  assert.equal(formatDashboardActivity("unknown", "unknown"), "Memproses data operasional");
});

test("status dan tingkat pelanggaran dashboard memakai Bahasa Indonesia", () => {
  assert.equal(formatSubscriptionStatus("grace"), "Masa tenggang");
  assert.equal(formatSubscriptionStatus("not_configured"), "Belum diatur");
  assert.equal(formatDisciplineSeverity("moderate"), "Sedang");
});

test("ringkasan pegawai mempertahankan kategori kosong dan menormalkan nilai", () => {
  const summary = buildEmployeeSummary([
    { dimension: "gender", label: "male", value: "3" },
    { dimension: "gender", label: "undisclosed", value: "2" },
    { dimension: "status", label: "probation", value: 1 },
    { dimension: "tenure", label: "3_to_5", value: 4 },
    { dimension: "employment_type", label: "PKWTT", value: 2 },
    { dimension: "employment_type", label: "Belum ditentukan", value: 1 },
  ]);

  assert.deepEqual(summary.gender.categories, ["Pria", "Wanita", "Lainnya", "Belum diisi"]);
  assert.deepEqual(summary.gender.series[0].data, [3, 0, 0, 2]);
  assert.deepEqual(summary.status.series[0].data, [0, 1, 0]);
  assert.deepEqual(summary.tenure.series[0].data, [0, 0, 4, 0]);
  assert.deepEqual(summary.employmentType.categories, ["PKWTT", "Belum ditentukan"]);
});

test("rentang dashboard menerima batas 24 bulan dan menolak rentang lebih panjang", () => {
  assert.deepEqual(normalizeDashboardRange("2024-01-01", "2025-12-31"), {
    startDate: "2024-01-01",
    endDate: "2025-12-31",
  });
  assert.throws(() => normalizeDashboardRange("2024-01-01", "2026-01-01"), /maksimal 24 bulan/);
});

test("rentang default dashboard dimulai 1 Januari sampai hari ini", () => {
  assert.deepEqual(normalizeDashboardRange(null, null, new Date("2026-08-28T12:00:00.000Z")), {
    startDate: "2026-01-01",
    endDate: "2026-08-28",
  });
});
