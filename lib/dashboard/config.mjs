export const DASHBOARD_PERIODS = Object.freeze({
  "6m": 6,
  "12m": 12,
  "24m": 24,
});

/** Menormalisasi periode dashboard agar query tidak menerima interval bebas dari klien. */
export function normalizeDashboardPeriod(value) {
  return Object.hasOwn(DASHBOARD_PERIODS, value) ? value : "12m";
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Dua belas bulan kalender termasuk bulan berjalan, mengikuti timezone organisasi. */
export function getDashboardTrendRange(timeZone = "Asia/Makassar", now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return {
    startDate: toIsoDate(new Date(Date.UTC(Number(value.year), Number(value.month) - 12, 1))),
    endDate: `${value.year}-${value.month}-${value.day}`,
  };
}

/** Menghasilkan tanggal ISO UTC agar default dashboard stabil di seluruh timezone server. */
function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

/** Memvalidasi rentang dashboard dengan default awal tahun hingga hari ini. */
export function normalizeDashboardRange(startDate, endDate, now = new Date()) {
  const defaultEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const defaultStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const normalizedStart = startDate || toIsoDate(defaultStart);
  const normalizedEnd = endDate || toIsoDate(defaultEnd);
  if (!ISO_DATE_PATTERN.test(normalizedStart) || !ISO_DATE_PATTERN.test(normalizedEnd)) {
    throw new Error("Format rentang tanggal dashboard tidak valid.");
  }
  const start = new Date(`${normalizedStart}T00:00:00.000Z`);
  const end = new Date(`${normalizedEnd}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    throw new Error("Tanggal awal dashboard harus sebelum atau sama dengan tanggal akhir.");
  }
  const maximumEnd = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 24, 0));
  if (end > maximumEnd) {
    throw new Error("Rentang dashboard maksimal 24 bulan.");
  }
  return { startDate: normalizedStart, endDate: normalizedEnd };
}

/** Menerjemahkan status masa akses database menjadi label dashboard yang mudah dipahami. */
export function formatSubscriptionStatus(value) {
  const labels = {
    scheduled: "Belum dimulai",
    active: "Aktif",
    grace: "Masa tenggang",
    expired: "Kedaluwarsa",
    suspended: "Ditangguhkan",
    cancelled: "Dibatalkan",
    not_configured: "Belum diatur",
  };
  return labels[value] || "Status tidak diketahui";
}

/** Menerjemahkan tingkat pelanggaran agar kode enum tidak bocor ke antarmuka. */
export function formatDisciplineSeverity(value) {
  return { light: "Ringan", moderate: "Sedang", severe: "Berat" }[value] || "Lainnya";
}

const EMPLOYEE_GENDER_ORDER = ["male", "female", "other", "undisclosed"];
const EMPLOYEE_STATUS_ORDER = ["active", "probation", "suspended"];
const TENURE_ORDER = ["under_1", "1_to_3", "3_to_5", "over_5"];

/** Menerjemahkan jenis kelamin profil tanpa menyembunyikan data yang belum dilengkapi. */
export function formatEmployeeGender(value) {
  return (
    {
      male: "Pria",
      female: "Wanita",
      other: "Lainnya",
      undisclosed: "Belum diisi",
    }[value || "undisclosed"] || "Belum diisi"
  );
}

/** Menerjemahkan status tenaga kerja yang termasuk dalam snapshot dashboard. */
export function formatEmployeeStatus(value) {
  return (
    {
      active: "Aktif",
      probation: "Masa percobaan",
      suspended: "Ditangguhkan",
    }[value] || "Status lainnya"
  );
}

/** Menerjemahkan kelompok masa kerja yang dihitung oleh query snapshot. */
export function formatEmployeeTenure(value) {
  return (
    {
      under_1: "< 1 tahun",
      "1_to_3": "1–3 tahun",
      "3_to_5": "3–5 tahun",
      over_5: "> 5 tahun",
    }[value] || "Belum ditentukan"
  );
}

/** Menyusun hasil agregasi SQL menjadi dataset chart dengan urutan kategori yang stabil. */
export function buildEmployeeSummary(rows = []) {
  const grouped = new Map();
  for (const row of rows) {
    const key = `${row.dimension}:${row.label}`;
    const value = Number(row.value);
    grouped.set(key, Number.isFinite(value) ? value : 0);
  }

  const buildOrderedSeries = (dimension, values, formatter) => ({
    categories: values.map(formatter),
    series: [
      {
        name: "Pegawai",
        data: values.map((value) => grouped.get(`${dimension}:${value}`) || 0),
      },
    ],
  });

  const employmentTypes = rows
    .filter((row) => row.dimension === "employment_type")
    .map((row) => String(row.label || "Belum ditentukan"))
    .sort((left, right) => {
      if (left === "Belum ditentukan") return 1;
      if (right === "Belum ditentukan") return -1;
      return left.localeCompare(right, "id-ID");
    });

  return {
    gender: buildOrderedSeries("gender", EMPLOYEE_GENDER_ORDER, formatEmployeeGender),
    status: buildOrderedSeries("status", EMPLOYEE_STATUS_ORDER, formatEmployeeStatus),
    tenure: buildOrderedSeries("tenure", TENURE_ORDER, formatEmployeeTenure),
    employmentType: buildOrderedSeries("employment_type", employmentTypes, (value) =>
      value === "Belum ditentukan" ? "Tanpa kontrak aktif" : value,
    ),
  };
}

/** Menyusun kontrak publik ulang tahun tanpa meneruskan tanggal/tahun lahir asli. */
export function buildBirthdaySummary(rows = [], asOf, windowDays = 30) {
  const items = rows.map((row) => ({
    employeeId: row.employee_id,
    organizationId: row.organization_id,
    fullName: row.full_name,
    preferredName: row.preferred_name,
    profilePhotoFileId: row.profile_photo_file_id,
    positionName: row.position_name,
    locationName: row.location_name,
    celebrationDate: row.celebration_date,
    daysUntil: Number(row.days_until),
    ageTurning: Number(row.age_turning),
  }));
  return {
    asOf,
    windowDays,
    todayCount: items.filter((item) => item.daysUntil === 0).length,
    upcomingCount: items.filter((item) => item.daysUntil > 0).length,
    items,
  };
}

/** Mengubah kode audit teknis menjadi aktivitas singkat yang mudah dipahami pengguna. */
export function formatDashboardActivity(action, entityType) {
  const specificLabels = {
    "login.success": "Masuk ke SITOU",
    "profile_self.update": "Memperbarui profil akun sendiri",
    "organization_account.create": "Menambahkan akun organisasi",
    "organization_account.update": "Memperbarui akun organisasi",
    "employee.update": "Memperbarui identitas dan kontak pegawai",
    "employee.profile_sections.update": "Memperbarui profil lengkap pegawai",
    "employee.terminate": "Mencatat akhir hubungan kerja pegawai",
    "employee_import.employee_commit": "Menambahkan pegawai melalui import",
    "employee_import.validate": "Memeriksa data import pegawai",
    "employee_import.commit": "Menyimpan hasil import pegawai",
    "organization_account.password_reset": "Mereset password akun organisasi",
    "profile_self.password_change": "Mengganti password akun",
    "profile_self.link": "Menghubungkan akun dengan profil pegawai",
    "report.export": "Mengunduh laporan",
    "report.view": "Melihat laporan",
    "employee.export_sensitive": "Mengunduh Excel data pegawai",
    "leave_balance.adjust": "Menyesuaikan saldo cuti pegawai",
  };
  if (specificLabels[action]) return specificLabels[action];
  const entityLabels = {
    employee: "data pegawai",
    employment_contract: "kontrak kerja",
    employee_assignment: "penempatan pegawai",
    discipline_case: "kasus disiplin",
    disciplinary_action: "tindakan disiplin",
    organization: "organisasi",
    user: "akun organisasi",
    location: "lokasi",
    organization_unit: "Divisi & Unit",
    organization_unit_type: "jenis unit organisasi",
    position: "jabatan",
    employment_type: "jenis kepegawaian",
    leave_type: "jenis cuti dan izin",
    leave_request: "cuti atau izin pegawai",
    disciplinary_action_type: "pengaturan sanksi",
    organization_retirement_policy: "kebijakan pensiun",
    employee_import_batch: "import pegawai",
  };
  const actionLabels = {
    create: "Menambahkan",
    update: "Memperbarui",
    cancel: "Membatalkan",
    revoke: "Mencabut",
    upload: "Mengunggah",
    correct: "Mengoreksi",
    approve: "Menyetujui",
    deactivate: "Menonaktifkan",
    expire: "Mencatat berakhirnya",
    supersede: "Menggantikan",
  };
  const normalizedAction = String(action || "").toLowerCase();
  const verb =
    Object.entries(actionLabels).find(([key]) => normalizedAction.includes(key))?.[1] ||
    "Memproses";
  return `${verb} ${entityLabels[entityType] || "data operasional"}`;
}

/** Hanya kode audit yang telah dipahami boleh tampil di feed operasional organisasi. */
export const ORGANIZATION_ACTIVITY_ACTIONS = Object.freeze([
  "login.success",
  "employee.create",
  "employee.update",
  "employee.profile_sections.update",
  "employee.terminate",
  "profile_self.update",
  "profile_self.link",
  "profile_self.password_change",
  "employee_import.validate",
  "employee_import.commit",
  "employee_import.employee_commit",
  "employee.export_sensitive",
  "organization_account.create",
  "organization_account.update",
  "organization_account.password_reset",
  "employment_contract.create",
  "employment_contract.correct",
  "employment_contract.cancel",
  "employee_assignment.create",
  "employee_assignment.correct",
  "discipline_case.create",
  "discipline_case.update",
  "disciplinary_action.create",
  "disciplinary_action.update",
  "disciplinary_action.revoke",
  "disciplinary_action.expire",
  "disciplinary_action.supersede",
  "leave_request.approve",
  "leave_request.cancel",
  "leave_balance.adjust",
  "report.view",
  "report.export",
  "retirement_policy.update",
  ...[
    "location",
    "organization_unit",
    "organization_unit_type",
    "position",
    "employment_type",
  ].flatMap((entity) => ["create", "update", "deactivate"].map((verb) => `${entity}.${verb}`)),
  ...["leave_type", "disciplinary_action_type"].flatMap((entity) =>
    ["create", "update"].map((verb) => `${entity}.${verb}`),
  ),
]);

/** Ringkasan target hanya memakai metadata publik terpilih, tanpa payload audit lengkap. */
export function formatDashboardActivitySubject(row) {
  if (row.employee_name)
    return `Nama pegawai: ${row.employee_name} · NIP: ${row.employee_no || "belum tersedia"}`;
  if (row.entity_type === "user")
    return `Akun: ${row.target_username ? `@${row.target_username}` : "belum tersedia"}`;
  const targetLabels = {
    location: "Lokasi",
    organization_unit: "Divisi & Unit",
    organization_unit_type: "Jenis unit",
    position: "Jabatan",
    employment_type: "Jenis kepegawaian",
    leave_type: "Jenis cuti dan izin",
    disciplinary_action_type: "Jenis sanksi",
  };
  if (targetLabels[row.entity_type])
    return `${targetLabels[row.entity_type]}: ${row.target_name || "belum tersedia"}`;
  if (row.entity_type === "report") {
    const reports = {
      "expiring-contracts": "Kontrak Akan Berakhir",
      retirements: "Proyeksi Pensiun",
      "disciplinary-actions": "Sanksi Pegawai",
    };
    return `Laporan: ${reports[row.report_kind] || "laporan organisasi"}`;
  }
  if (row.entity_type === "employee_export")
    return `Data pegawai: ${formatActivityCount(row.employee_count)} pegawai`;
  if (row.entity_type === "employee_import_batch")
    return row.action === "employee_import.commit"
      ? `Hasil import: ${formatActivityCount(row.import_count)} pegawai tersimpan`
      : "Data import pegawai diperiksa sebelum disimpan";
  if (row.entity_type === "organization_retirement_policy")
    return "Pengaturan usia pensiun organisasi";
  return "Data terkait tidak tersedia";
}

/** Jumlah berasal dari metadata audit terpilih dan tidak menampilkan nilai tidak valid. */
function formatActivityCount(value) {
  const count = Number(value);
  return value != null && Number.isSafeInteger(count) && count >= 0
    ? new Intl.NumberFormat("id-ID").format(count)
    : "jumlah belum tersedia";
}
