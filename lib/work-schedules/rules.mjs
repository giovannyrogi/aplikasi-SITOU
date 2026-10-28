/** Aturan murni jadwal; tidak memakai jam perangkat atau data organisasi global. */
export class ScheduleRuleError extends Error {
  constructor(message, field = "form", code = "SCHEDULE_INVALID") {
    super(message);
    this.code = code;
    this.status = 422;
    this.fieldErrors = { [field]: message };
  }
}
export const fail = (message, field = "form", code) => {
  throw new ScheduleRuleError(message, field, code);
};
export const dateValid = (value) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(value + "T00:00:00Z")) &&
  new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value;
export const addDays = (date, n) =>
  new Date(Date.parse(date + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);
export const dayDiff = (a, b) =>
  Math.round((Date.parse(a + "T00:00:00Z") - Date.parse(b + "T00:00:00Z")) / 86400000);
export function localDate(instant, zone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
export function minute(value) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value || "")) fail("Isi jam yang valid.", "rules");
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
}
export function validateRules(r) {
  if (!["fixed", "flexible", "off"].includes(r.type))
    fail("Jenis shift tidak tersedia.", "rules.type");
  if (r.type === "off") {
    if (
      r.startTime ||
      r.endTime ||
      r.windowStart ||
      r.windowEnd ||
      r.latestFinish ||
      r.breakMinutes ||
      r.requiredMinutes ||
      r.lateTolerance ||
      r.earlyTolerance ||
      r.nextDay
    )
      fail("Libur tidak memiliki jam kerja.", "rules.type");
    return r;
  }
  const start = minute(r.type === "fixed" ? r.startTime : r.windowStart);
  const end = minute(r.type === "fixed" ? r.endTime : r.latestFinish) + (r.nextDay ? 1440 : 0);
  if (end <= start || end - start > 1440)
    fail("Rentang kerja harus lebih dari nol dan maksimal 24 jam.", "rules.endTime");
  if (r.breakMinutes >= end - start)
    fail("Istirahat harus lebih singkat dari rentang kerja.", "rules.breakMinutes");
  if (r.type === "flexible") {
    const latest = minute(r.windowEnd);
    if (latest < start || latest >= end)
      fail("Akhir rentang masuk tidak sesuai.", "rules.windowEnd");
    if (
      !r.requiredMinutes ||
      latest + r.requiredMinutes + (r.deductBreak ? r.breakMinutes : 0) > end
    )
      fail("Target kerja tidak muat sebelum batas selesai.", "rules.requiredMinutes");
  }
  return r;
}
/** Tolak waktu DST yang tidak ada/ambigu daripada menggeser jadwal diam-diam. */
export function absoluteTime(date, minutes, zone) {
  const target = Date.parse(date + "T00:00:00Z") + minutes * 60000;
  const f = new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const wall = (t) => {
    const p = Object.fromEntries(f.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  };
  let value = target;
  for (let i = 0; i < 5; i++) {
    const delta = target - wall(value);
    value += delta;
    if (!delta) break;
  }
  if (wall(value) !== target)
    fail("Jam tidak tersedia pada zona waktu organisasi.", "date", "TIMEZONE_TRANSITION");
  for (const offset of [-7200000, -3600000, 3600000, 7200000])
    if (wall(value + offset) === target)
      fail(
        "Jam berulang pada zona waktu organisasi. Pilih jam lain.",
        "date",
        "TIMEZONE_TRANSITION",
      );
  return new Date(value).toISOString();
}
export function dayNumber(date, pattern, anchor) {
  return pattern.pattern_type === "weekly"
    ? ((new Date(date + "T12:00:00Z").getUTCDay() + 6) % 7) + 1
    : (((dayDiff(date, anchor) % pattern.cycle_days) + pattern.cycle_days) % pattern.cycle_days) +
        1;
}
export function makeSessions(date, shifts, zone) {
  if (shifts.some((x) => x.rules.type === "off")) {
    if (shifts.length !== 1) fail("Libur tidak dapat digabung dengan sesi kerja.", "days");
    return [];
  }
  const sessions = shifts.map((s, i) => {
    const r = s.rules;
    validateRules(r);
    return {
      sessionNo: i + 1,
      shiftId: String(s.id),
      revisionId: String(s.revision_id),
      name: s.name,
      rules: r,
      startsAt: absoluteTime(date, minute(r.type === "fixed" ? r.startTime : r.windowStart), zone),
      endsAt: absoluteTime(
        date,
        minute(r.type === "fixed" ? r.endTime : r.latestFinish) + (r.nextDay ? 1440 : 0),
        zone,
      ),
    };
  });
  assertNoOverlap(sessions);
  return sessions;
}
export function assertNoOverlap(sessions) {
  const sorted = [...sessions].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  for (let i = 1; i < sorted.length; i++)
    if (Date.parse(sorted[i].startsAt) < Date.parse(sorted[i - 1].endsAt))
      fail("Sesi kerja bertabrakan.", "sessions", "SESSION_OVERLAP");
}
export function validateRange(from, until) {
  if (
    !dateValid(from) ||
    !dateValid(until) ||
    dayDiff(until, from) < 0 ||
    dayDiff(until, from) > 30
  )
    fail("Pilih rentang maksimal 31 hari.", "until");
}
