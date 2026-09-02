import dayjs from "dayjs";

const FINAL_EMPLOYMENT_STATUSES = new Set(["terminated", "retired", "deceased"]);

function parseDateOnly(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = dayjs(value);
  return parsed.isValid() && parsed.format("YYYY-MM-DD") === value ? parsed.startOf("day") : null;
}

function formatDuration(years, months, days) {
  return `${years} tahun ${months} bulan ${days} hari`;
}

/** Menghitung masa kerja kalender tanpa menyimpan nilai turunan di database. */
export function calculateEmployeeTenure({
  joinedDate,
  terminationDate,
  employmentStatus,
  today = dayjs().format("YYYY-MM-DD"),
}) {
  const start = parseDateOnly(joinedDate);
  if (!start) {
    return {
      valid: false,
      message: joinedDate
        ? "Data tanggal perlu diperiksa."
        : "Belum dapat dihitung karena tanggal bergabung belum tersedia.",
    };
  }

  const finalEmploymentStatus = FINAL_EMPLOYMENT_STATUSES.has(employmentStatus);
  const boundaryValue = finalEmploymentStatus ? terminationDate : today;
  const end = parseDateOnly(boundaryValue);
  if (!end || end.isBefore(start, "day")) {
    return { valid: false, message: "Data tanggal perlu diperiksa." };
  }

  const years = end.diff(start, "year");
  const afterYears = start.add(years, "year");
  const months = end.diff(afterYears, "month");
  const afterMonths = afterYears.add(months, "month");
  const days = end.diff(afterMonths, "day");

  return {
    valid: true,
    years,
    months,
    days,
    duration: formatDuration(years, months, days),
    throughDate: end.format("YYYY-MM-DD"),
    throughToday: !finalEmploymentStatus,
  };
}
