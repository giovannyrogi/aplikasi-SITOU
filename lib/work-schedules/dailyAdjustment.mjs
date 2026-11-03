import { assertNoOverlap, dayNumber, fail, makeSessions } from "./rules.mjs";

/** One chosen schedule, never all alternatives in a shift group. */
export function adjustmentShiftIds(pattern, date, from, groupShiftId = null) {
  if (groupShiftId) return [String(groupShiftId)];
  if (pattern.pattern_type !== "weekly")
    fail(
      "Jadwal rotasi belum dapat dipakai di sini. Pilih jadwal mingguan atau satu shift.",
      "patternId",
    );
  const ids =
    pattern.days.find((day) => day.day === dayNumber(date, pattern, from))?.shiftIds || [];
  if (!ids.length)
    fail(
      `Jadwal yang dipilih tidak memiliki jam kerja pada ${date}. Pilih tanggal lain atau pilihan shift.`,
      "range",
    );
  return ids;
}

/** Keep the resolved hours on addition; replacement deliberately discards them. */
export function composeDailyAdjustment({ date, before, shifts, mode, timezone, employeeName }) {
  const chosen = makeSessions(date, shifts, timezone);
  if (!chosen.length) fail("Pilih jam kerja, bukan jadwal libur.", "patternId");
  const sessions = [...(mode === "add" ? before : []), ...chosen].sort(
    (a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt),
  );
  if (sessions.length > 16)
    fail(
      `Jam kerja ${employeeName} pada ${date} melebihi 16 periode. Kurangi jam kerja tambahan.`,
      "patternId",
    );
  try {
    assertNoOverlap(sessions);
  } catch {
    fail(
      `Jam kerja ${employeeName} pada ${date} bertabrakan: ${sessions.map((s) => hoursLabel(s.rules)).join(" dan ")}. Pilih jam kerja lain.`,
      "patternId",
      "SESSION_OVERLAP",
    );
  }
  return sessions.map((session, index) => ({ ...session, sessionNo: index + 1 }));
}

export function hoursLabel(rules) {
  if (!rules || rules.type === "off") return "Hari libur";
  if (rules.type === "flexible")
    return `${rules.windowStart}–${rules.latestFinish}${rules.nextDay ? " besok" : ""} (fleksibel)`;
  return `${rules.startTime}–${rules.endTime}${rules.nextDay ? " besok" : ""}`;
}
