import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  buildBirthdaySummary,
  buildEmployeeSummary,
  DASHBOARD_PERIODS,
  formatDisciplineSeverity,
  formatDashboardActivity,
  formatDashboardActivitySubject,
  ORGANIZATION_ACTIVITY_ACTIONS,
  formatSubscriptionStatus,
  normalizeDashboardPeriod,
  normalizeDashboardRange,
  getDashboardTrendRange,
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

test("aktivitas dashboard membedakan perubahan profil, histori, dan import", () => {
  for (const [action, entity, expected] of [
    ["employee.update", "employee", "Memperbarui identitas dan kontak pegawai"],
    ["employee.profile_sections.update", "employee", "Memperbarui profil lengkap pegawai"],
    ["employment_contract.correct", "employment_contract", "Mengoreksi kontrak kerja"],
    ["employee_assignment.correct", "employee_assignment", "Mengoreksi penempatan pegawai"],
    ["organization_account.password_reset", "user", "Mereset password akun organisasi"],
    ["employee_import.employee_commit", "employee", "Menambahkan pegawai melalui import"],
  ])
    assert.equal(formatDashboardActivity(action, entity), expected);
});

test("login dan setiap kode feed mempunyai label tindakan yang jelas", () => {
  assert.equal(formatDashboardActivity("login.success", "user"), "Masuk ke SITOU");
  for (const action of ORGANIZATION_ACTIVITY_ACTIONS) {
    const entity =
      {
        organization_account: "user",
        profile_self: "user",
        login: "user",
        employee_import: "employee_import_batch",
        retirement_policy: "organization_retirement_policy",
        leave_balance: "leave_request",
      }[action.split(".")[0]] || action.split(".")[0];
    assert.doesNotMatch(formatDashboardActivity(action, entity), /Memproses|data operasional/);
  }
});

test("target aktivitas memakai label pegawai, NIP, akun, master, dan laporan yang jelas", () => {
  assert.equal(
    formatDashboardActivitySubject({ employee_name: "Nama Contoh", employee_no: "001" }),
    "Nama pegawai: Nama Contoh · NIP: 001",
  );
  assert.equal(
    formatDashboardActivitySubject({ entity_type: "user", target_username: "akuncontoh" }),
    "Akun: @akuncontoh",
  );
  assert.equal(
    formatDashboardActivitySubject({ entity_type: "location", target_name: "Pasar Contoh" }),
    "Lokasi: Pasar Contoh",
  );
  assert.equal(
    formatDashboardActivitySubject({ entity_type: "report", report_kind: "retirements" }),
    "Laporan: Proyeksi Pensiun",
  );
  assert.equal(
    formatDashboardActivitySubject({ entity_type: "employee_export", employee_count: "326" }),
    "Data pegawai: 326 pegawai",
  );
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
  assert.deepEqual(summary.employmentType.categories, ["PKWTT", "Tanpa kontrak aktif"]);
});

test("ringkasan ulang tahun hanya mengirim data perayaan tanpa tahun lahir", () => {
  const summary = buildBirthdaySummary(
    [
      {
        employee_id: "11",
        organization_id: "3",
        full_name: "Pegawai Hari Ini",
        preferred_name: "Hari",
        profile_photo_file_id: "91",
        position_name: "Staf",
        location_name: "Kantor Pusat",
        celebration_date: "2026-09-20",
        days_until: "0",
        age_turning: "36",
        birth_date: "1990-09-20",
      },
      {
        employee_id: "12",
        organization_id: "3",
        full_name: "Pegawai Mendatang",
        celebration_date: "2026-10-20",
        days_until: "30",
        age_turning: "29",
      },
    ],
    "2026-09-20",
  );

  assert.equal(summary.todayCount, 1);
  assert.equal(summary.upcomingCount, 1);
  assert.equal(summary.windowDays, 30);
  assert.equal(summary.items[1].daysUntil, 30);
  assert.equal(summary.items[0].ageTurning, 36);
  assert.equal(summary.items[1].ageTurning, 29);
  assert.equal(Object.hasOwn(summary.items[0], "birth_date"), false);
  assert.equal(JSON.stringify(summary).includes("1990"), false);
});

test("query dan panel ulang tahun menjaga scope, rentang, aksesibilitas, dan autoplay", () => {
  const service = readFileSync(
    new URL("../lib/dashboard/birthdayQuery.mjs", import.meta.url),
    "utf8",
  );
  const client = readFileSync(
    new URL("../app/components/dashboard/BirthdaySpotlight.jsx", import.meta.url),
    "utf8",
  );
  const dashboard = readFileSync(
    new URL("../app/components/dashboard/DashboardClient.jsx", import.meta.url),
    "utf8",
  );

  assert.match(service, /generate_series\(\$2::date,\$2::date\+30/);
  assert.match(service, /employee\.employment_status IN \('active','probation'\)/);
  assert.match(service, /scoped_assignment\.location_id=ANY\(\$3::bigint\[\]\)/);
  assert.match(service, /SELECT day::date,2,29/);
  assert.match(service, /AS age_turning/);
  assert.doesNotMatch(service, /birthdaySummary[\s\S]{0,500}birth_date/);
  assert.match(client, /prefers-reduced-motion: reduce/);
  assert.match(client, /5000/);
  assert.match(client, /visibilitychange/);
  assert.match(client, /Ulang tahun hari ini/);
  assert.match(client, /Akan datang dalam 30 hari/);
  assert.match(client, /Genap \$\{value\} tahun/);
  assert.match(dashboard, /!isSuperadmin \|\| organizationId/);
});

test("rentang dashboard menerima batas 24 bulan dan menolak rentang lebih panjang", () => {
  assert.deepEqual(normalizeDashboardRange("2024-01-01", "2025-12-31"), {
    startDate: "2024-01-01",
    endDate: "2025-12-31",
  });
  assert.throws(() => normalizeDashboardRange("2024-01-01", "2026-01-01"), /maksimal 24 bulan/);
});

test("tren dashboard memakai dua belas bulan kalender hingga hari ini", () => {
  assert.deepEqual(getDashboardTrendRange("Asia/Makassar", new Date("2026-08-28T12:00:00.000Z")), {
    startDate: "2025-09-01",
    endDate: "2026-08-28",
  });
  assert.deepEqual(getDashboardTrendRange("Asia/Makassar", new Date("2025-12-31T17:00:00Z")), {
    startDate: "2025-02-01",
    endDate: "2026-01-01",
  });
  assert.deepEqual(getDashboardTrendRange("UTC", new Date("2024-02-29T12:00:00Z")), {
    startDate: "2023-03-01",
    endDate: "2024-02-29",
  });
});
