import assert from "node:assert/strict";
import test from "node:test";
import {
  DASHBOARD_PERIODS,
  formatDisciplineSeverity,
  formatDashboardActivity,
  formatSubscriptionStatus,
  normalizeDashboardPeriod,
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
