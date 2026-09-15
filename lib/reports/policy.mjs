import { z } from "zod";

export const REPORT_TITLES = {
  retirements: "Proyeksi Pensiun",
  "expiring-contracts": "Kontrak Akan Berakhir",
};
export const EXPORT_LIMIT = 5000;
export const DEFAULT_REPORT_PAGE_SIZE = 10;

/** Date-only diperiksa ketat agar tanggal seperti 31 Februari tidak dinormalisasi diam-diam. */
export function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Penambahan bulan menjepit akhir bulan, termasuk ulang tahun 29 Februari. */
export function addMonths(value, months) {
  const date = new Date(`${value}T00:00:00Z`);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, last));
  return date.toISOString().slice(0, 10);
}

/** Acuan kalender mengikuti timezone organisasi, bukan timezone komputer pengguna. */
export function organizationToday(timezone, now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone || "Asia/Makassar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** ID publik harus muat dalam bigint PostgreSQL. */
export function validReportId(value) {
  return /^[1-9]\d{0,18}$/.test(value || "") && BigInt(value) <= 9223372036854775807n;
}

const id = z.string().refine(validReportId, "Pilihan tidak valid.").optional();
const date = z
  .string()
  .refine(validDate, "Tanggal harus valid dengan format YYYY-MM-DD.")
  .optional();
const schema = z.object({
  organizationId: id,
  locationId: id,
  organizationUnitId: id,
  positionId: id,
  employmentTypeId: id,
  search: z.string().trim().max(120, "Pencarian maksimal 120 karakter.").default(""),
  group: z
    .enum(["upcoming", "overdue", "all", "invalid"], { error: "Kelompok laporan tidak valid." })
    .default("upcoming"),
  period: z
    .enum(["30d", "60d", "90d", "3m", "6m", "12m", "24m", "year", "custom", "none"], {
      error: "Periode laporan tidak valid.",
    })
    .optional(),
  startDate: date,
  endDate: date,
  successor: z
    .enum(["all", "yes", "no"], { error: "Pilihan kontrak berikutnya tidak valid." })
    .default("all"),
  pageSize: z.coerce.number().int().min(1).max(50).default(DEFAULT_REPORT_PAGE_SIZE),
  cursor: z.string().max(1000).optional(),
});

/** Menormalisasi satu kontrak filter untuk SQL, tautan dashboard, dan Excel. */
export function normalizeReportFilters(kind, input, today) {
  const parsed = schema.safeParse(input);
  const fail = (fields) => {
    const error = new Error(Object.values(fields)[0]);
    error.fieldErrors = fields;
    throw error;
  };
  if (!parsed.success)
    fail(
      Object.fromEntries(parsed.error.issues.map((issue) => [issue.path.join("."), issue.message])),
    );
  const filters = parsed.data;
  const retirement = kind === "retirements";
  if (!Object.hasOwn(REPORT_TITLES, kind)) fail({ report: "Laporan tidak tersedia." });
  if (!retirement && filters.group === "invalid")
    fail({ group: "Kelompok tanggal lahir hanya tersedia pada laporan pensiun." });
  filters.period ||= ["overdue", "invalid"].includes(filters.group)
    ? "none"
    : retirement
      ? "12m"
      : "30d";
  const allowed = retirement
    ? ["3m", "6m", "12m", "24m", "year", "custom", "none"]
    : ["30d", "60d", "90d", "custom", "none"];
  if (!allowed.includes(filters.period)) fail({ period: "Periode tidak sesuai jenis laporan." });
  if (filters.group === "invalid") {
    filters.period = "none";
    filters.startDate = undefined;
    filters.endDate = undefined;
  } else if (filters.period === "custom") {
    if (!filters.startDate || !filters.endDate)
      fail({ startDate: "Pilih tanggal awal dan akhir laporan." });
    if (filters.startDate > filters.endDate)
      fail({ endDate: "Tanggal akhir tidak boleh sebelum tanggal awal." });
  } else if (filters.period === "none") {
    if (filters.group !== "overdue")
      fail({ period: "Pilih periode atau rentang tanggal laporan." });
    filters.startDate = undefined;
    filters.endDate = undefined;
  } else {
    filters.startDate = today;
    if (filters.period === "year") {
      filters.startDate = `${today.slice(0, 4)}-01-01`;
      filters.endDate = `${today.slice(0, 4)}-12-31`;
    } else if (filters.period.endsWith("m"))
      filters.endDate = addMonths(today, Number.parseInt(filters.period));
    else {
      const end = new Date(`${today}T00:00:00Z`);
      end.setUTCDate(end.getUTCDate() + Number.parseInt(filters.period));
      filters.endDate = end.toISOString().slice(0, 10);
    }
  }
  return filters;
}

/** Perubahan kelompok menghapus periode masa depan yang bertentangan. */
export function changeReportFilters(filters, key, value, kind) {
  const next = { ...filters, [key]: value };
  delete next.cursor;
  if (key === "group") {
    if (!["overdue", "invalid"].includes(value) && ["year", "custom"].includes(filters.period))
      return next;
    next.period = ["overdue", "invalid"].includes(value)
      ? "none"
      : kind === "retirements"
        ? "12m"
        : "30d";
    delete next.startDate;
    delete next.endDate;
  }
  if (key === "period" && ["year", "custom"].includes(value)) next.group = "all";
  if (key === "period" && !["year", "custom", "none"].includes(value)) next.group = "upcoming";
  return next;
}

/** Status kalender yang sama ditampilkan pada tabel dan workbook. */
export function deadlineLabel(days, kind) {
  if (days == null) return "Tanggal lahir perlu diperiksa";
  if (days < 0) return `Lewat ${Math.abs(days)} hari`;
  if (days === 0)
    return kind === "retirements" ? "Mencapai usia pensiun hari ini" : "Berakhir hari ini";
  return `${days} hari lagi`;
}
