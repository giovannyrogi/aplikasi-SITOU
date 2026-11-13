export const ATTENDANCE_STATUS = {
  present: ["Hadir", "success"],
  late: ["Hadir", "success"],
  absent: ["Tidak hadir", "danger"],
  leave: ["Cuti", "info"],
  permission: ["Izin", "info"],
  sick: ["Sakit", "info"],
  official_duty: ["Dinas", "info"],
  off: ["Libur jadwal", "neutral"],
  holiday: ["Hari libur", "neutral"],
  incomplete: ["Absensi belum lengkap", "warning"],
  needs_review: ["Perlu tinjau", "warning"],
};

export const ATTENDANCE_INDICATOR = {
  early_check_in: ["Masuk lebih awal", "earlyArrival"],
  late_check_in: ["Terlambat", "warning"],
  on_time: ["Tepat waktu", "success"],
  early_check_out: ["Pulang lebih awal", "earlyLeave"],
  late_check_out: ["Pulang lebih lambat", "info"],
  flexible_check_in: ["Masuk fleksibel", "info"],
  outside_radius: ["Di luar radius", "danger"],
  near_boundary: ["Dekat batas radius", "info"],
  outside_schedule: ["Di luar jadwal", "outsideSchedule"],
  holiday_work: ["Bekerja saat libur", "holidayWork"],
  unassessed: ["Waktu belum dinilai", "neutral"],
  incomplete: ["Absensi belum lengkap", "warning"],
  needs_review: ["Perlu tinjau", "warning"],
};

export const ON_TIME_BY_ACTION = {
  check_in: ["Masuk tepat waktu", "success"],
  check_out: ["Pulang tepat waktu", "success"],
};

export function attendanceMissingLabel(row) {
  if (!["incomplete", "needs_review", "off", "holiday"].includes(row.attendance_status))
    return null;

  const missingIn = row.missing_check_in_count > 0 || (!row.first_check_in && row.last_check_out);
  const missingOut =
    row.missing_check_out_count > 0 ||
    row.open_session_count > 0 ||
    (row.first_check_in && !row.last_check_out);

  if (missingIn && missingOut) return "Absen masuk dan pulang belum lengkap";
  if (missingIn) return "Belum absen masuk";
  if (missingOut) return "Belum absen pulang";
  return null;
}

export function attendanceIndicator(key) {
  if (key === "on_time_check_in") return ON_TIME_BY_ACTION.check_in;
  if (key === "on_time_check_out") return ON_TIME_BY_ACTION.check_out;
  return ATTENDANCE_INDICATOR[key];
}

export function attendanceRowIndicators(row) {
  const keys = new Set(row.indicators);
  if (row.attendance_status === "late") keys.add("late_check_in");
  keys.delete(row.attendance_status);
  return [...keys];
}

export function attendanceIndicatorLabel(key, lateMinutes) {
  if (key === "late_check_in" && lateMinutes > 0) return `Terlambat ${lateMinutes} menit`;
  return attendanceIndicator(key)?.[0];
}

export function attendanceSchedule(row, timezone) {
  return row.schedule.map(({ starts_at, ends_at }) =>
    [starts_at, ends_at].map((time) => attendanceTime(time, timezone, row.work_date)).join(" – "),
  );
}

export function attendanceLocalDate(value, timeZone) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

export function attendanceClock(value, timeZone) {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));
}

export function attendanceTime(value, timeZone, workDate) {
  if (!value) return "—";
  const localDate = attendanceLocalDate(value, timeZone);
  const hour = attendanceClock(value, timeZone);
  if (localDate === workDate) return hour;
  return (
    hour +
    " · " +
    new Intl.DateTimeFormat("id-ID", {
      timeZone,
      day: "numeric",
      month: "short",
    }).format(new Date(value))
  );
}

export function attendanceMinutes(value) {
  if (value == null) return "—";
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return [hours ? `${hours} jam` : "", minutes || !hours ? `${minutes} menit` : ""]
    .filter(Boolean)
    .join(" ");
}
