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
const EMPLOYEE_STATUS_ORDER = ["active", "probation", "leave"];
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
      leave: "Cuti",
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
    employmentType: buildOrderedSeries("employment_type", employmentTypes, (value) => value),
  };
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
