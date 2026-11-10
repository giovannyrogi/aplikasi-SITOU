import { holidayAssessment } from "./holiday-work.mjs";
/** Satu perhitungan untuk preflight, event, dan pembentukan ulang rekap. */
export function assessAttendance(session, kind, instant) {
  if (session.holidayWork || session.rules.type === "holiday_work") return holidayAssessment();
  const rules = session.rules;
  const flexible = rules.type !== "fixed";
  const reference =
    kind === "check_in"
      ? new Date(session.startsAt).getTime()
      : flexible && session.entered
        ? new Date(session.entered).getTime() +
          ((rules.requiredMinutes ?? 0) + (rules.deductBreak ? (rules.breakMinutes ?? 0) : 0)) *
            60000
        : new Date(session.endsAt).getTime();
  const delta = new Date(instant).getTime() - reference;
  const minutes = Math.floor(Math.abs(delta) / 60000);
  const early = delta < 0;
  const late = kind === "check_in" && !flexible && delta > (rules.lateTolerance ?? 0) * 60000;
  const earlyLeave = kind === "check_out" && delta < -(rules.earlyTolerance ?? 0) * 60000;
  const offerNote = kind === "check_in" ? (!flexible && early && minutes > 0) || late : minutes > 0;
  const duration = [
    Math.floor(minutes / 60) ? Math.floor(minutes / 60) + " jam" : "",
    minutes % 60 ? (minutes % 60) + " menit" : "",
  ]
    .filter(Boolean)
    .join(" ");
  let category = "on_time";
  if (kind === "check_in") {
    if (flexible) category = "flexible_check_in";
    else if (late) category = "late_check_in";
    else if (early) category = "early_check_in";
  } else if (earlyLeave) category = "early_check_out";
  else if (delta > 0) category = "late_check_out";
  return {
    offerNote,
    status: late ? "late" : earlyLeave ? "early_leave" : "recorded",
    message: offerNote
      ? late
        ? "Terlambat " + (duration || "kurang dari 1 menit")
        : (kind === "check_in" ? "Masuk " : "Pulang ") +
          duration +
          (early ? " sebelum jadwal" : " setelah jadwal")
      : "Absensi tercatat.",
    timing: {
      version: 1,
      category,
      referenceAt: new Date(reference).toISOString(),
      offsetSeconds: Math.trunc(delta / 1000),
      earlyArrivalMinutes: kind === "check_in" && !flexible && early ? minutes : 0,
      lateMinutes: late ? minutes : 0,
      earlyLeaveMinutes: earlyLeave ? minutes : 0,
      lateDepartureMinutes: kind === "check_out" && delta > 0 ? minutes : 0,
      lateToleranceMinutes: rules.lateTolerance ?? 0,
      earlyLeaveToleranceMinutes: rules.earlyTolerance ?? 0,
    },
  };
}
