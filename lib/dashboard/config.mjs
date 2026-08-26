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

/** Menghasilkan tanggal ISO UTC agar default dashboard stabil di seluruh timezone server. */
function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

/** Memvalidasi rentang dashboard dan membatasinya maksimal 24 bulan. */
export function normalizeDashboardRange(startDate, endDate, now = new Date()) {
  const defaultEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const defaultStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
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

/** Mengubah kode audit teknis menjadi aktivitas singkat yang mudah dipahami pengguna. */
export function formatDashboardActivity(action, entityType) {
  const entityLabels = {
    employee: "data pegawai",
    employment_contract: "kontrak kerja",
    employee_assignment: "penempatan pegawai",
    discipline_case: "kasus disiplin",
    disciplinary_action: "tindakan disiplin",
    organization: "organisasi",
    user: "akun organisasi",
  };
  const actionLabels = {
    create: "Menambahkan",
    update: "Memperbarui",
    cancel: "Membatalkan",
    revoke: "Mencabut",
    upload: "Mengunggah",
  };
  const normalizedAction = String(action || "").toLowerCase();
  const verb =
    Object.entries(actionLabels).find(([key]) => normalizedAction.includes(key))?.[1] ||
    "Memproses";
  return `${verb} ${entityLabels[entityType] || "data operasional"}`;
}
