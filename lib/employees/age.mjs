const DAY_MS = 86400000;
function parse(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) &&
    date.getUTCFullYear() > 0 &&
    date.toISOString().slice(0, 10) === value
    ? date
    : null;
}
function at(year, month, day) {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, Math.min(day, last));
  return date;
}

/** Usia kalender berdasarkan tanggal acuan organisasi, bukan jam/zona browser. */
export function calculateEmployeeAge({ birthDate, today, employmentStatus, terminationDate }) {
  const label = employmentStatus === "deceased" ? "Usia saat meninggal" : "Usia";
  const fail = (message) => ({ valid: false, label, message });
  if (!birthDate) return fail("Tanggal lahir belum diisi.");
  const birth = parse(birthDate);
  if (!birth) return fail("Tanggal lahir tidak valid.");
  if (employmentStatus === "deceased" && !terminationDate)
    return fail("Tanggal meninggal belum tersedia.");
  const end = parse(employmentStatus === "deceased" ? terminationDate : today);
  if (!end) return fail("Tanggal acuan usia belum tersedia atau tidak valid.");
  if (birth > end) return fail("Tanggal lahir tidak boleh setelah tanggal acuan usia.");
  let years = end.getUTCFullYear() - birth.getUTCFullYear();
  let anniversary = at(birth.getUTCFullYear() + years, birth.getUTCMonth() + 1, birth.getUTCDate());
  if (anniversary > end) {
    years--;
    anniversary = at(birth.getUTCFullYear() + years, birth.getUTCMonth() + 1, birth.getUTCDate());
  }
  let months =
    (end.getUTCFullYear() - anniversary.getUTCFullYear()) * 12 +
    end.getUTCMonth() -
    anniversary.getUTCMonth();
  months = Math.min(months, 11);
  const monthDate = (count) =>
    at(
      anniversary.getUTCFullYear() + Math.floor((anniversary.getUTCMonth() + count) / 12),
      ((anniversary.getUTCMonth() + count) % 12) + 1,
      anniversary.getUTCDate(),
    );
  if (monthDate(months) > end) months--;
  const days = Math.round((end - monthDate(months)) / DAY_MS);
  return {
    valid: true,
    label,
    years,
    months,
    days,
    duration: `${years} tahun ${months} bulan ${days} hari`,
  };
}
