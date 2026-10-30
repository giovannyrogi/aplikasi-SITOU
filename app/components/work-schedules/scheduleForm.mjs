import { validateRules } from "@/lib/work-schedules/rules.mjs";

export const emptyRules = () => ({
  type: "fixed",
  startTime: null,
  endTime: null,
  windowStart: null,
  windowEnd: null,
  latestFinish: null,
  requiredMinutes: 0,
  breakMinutes: 0,
  deductBreak: true,
  nextDay: false,
  lateTolerance: 0,
  earlyTolerance: 0,
});
export function canCopyScheduleDay(day) {
  if (!day?.sessions?.length) return false;
  try {
    day.sessions.forEach((s) => validateRules(s.rules));
    return true;
  } catch {
    return false;
  }
}
/** Salinan sekali, bukan hubungan jadwal yang ikut berubah kemudian. */
export function copyScheduleDay(days, from, to) {
  const source = days.find((d) => d.day === from);
  if (!canCopyScheduleDay(source) || from === to) return days;
  return days.map((day) =>
    day.day === to ? { ...day, sessions: structuredClone(source.sessions) } : day,
  );
}
/** Hari khusus tidak ikut berubah ketika jam utama diedit. Hari tidak dipilih tetap libur. */
export function weeklyScheduleDays(values) {
  const custom = new Set(
    values.customDays ?? (values.differentDays ? values.days?.map((d) => d.day) : []),
  );
  return Array.from({ length: 7 }, (_, i) => {
    const day = i + 1;
    const prior = values.days?.find((d) => d.day === day);
    if (!values.workingDays?.includes(day)) return { day, sessions: [] };
    if (custom.has(day)) return prior || { day, sessions: [] };
    const rules = values.sharedRules || emptyRules();
    const sessions =
      prior?.sessions.length === 1 &&
      JSON.stringify(prior.sessions[0].rules) === JSON.stringify(rules)
        ? structuredClone(prior.sessions)
        : [{ rules: structuredClone(rules) }];
    return { day, sessions };
  });
}
export function templateReview(values, original) {
  const payload = templatePayload(values, original);
  const displayDays = values.patternType === "weekly" ? weeklyScheduleDays(values) : values.days;
  return {
    payload,
    days: payload.days.map((d) => ({
      day: d.day,
      sessions: d.sessions.map((s, index) => ({
        ...s,
        rules: s.rules || displayDays.find((x) => x.day === d.day)?.sessions[index]?.rules,
      })),
    })),
  };
}
export function templateValues(item, copy = false) {
  if (item?.kind === "shift")
    return {
      name: item.name + (copy ? " (salinan)" : ""),
      isActive: item.is_active,
      workType: "shift",
      patternType: "weekly",
      cycleDays: 7,
      workingDays: [...item.working_days],
      calendarId: item.calendar_id || null,
      holidayPolicy: item.calendar_id ? item.holiday_policy : undefined,
      shifts: item.shifts.map((shift) => ({
        name: shift.name,
        rules: structuredClone(shift.rules),
      })),
      days: Array.from({ length: 7 }, (_, index) => ({ day: index + 1, sessions: [] })),
      customDays: [],
      sharedRules: emptyRules(),
    };
  const days = structuredClone(
    item?.days || Array.from({ length: 7 }, (_, i) => ({ day: i + 1, sessions: [] })),
  );
  const working = days.filter((d) => d.sessions.length);
  const first =
    working.find((d) => d.sessions.length === 1 && d.sessions[0].rules.type === "fixed")
      ?.sessions[0].rules || emptyRules();
  const simple =
    !item ||
    (item.pattern_type === "weekly" &&
      days.every((d) => d.sessions.length <= 1) &&
      working.every((d) => JSON.stringify(d.sessions[0].rules) === JSON.stringify(first)) &&
      first.type === "fixed");
  return {
    name: item ? item.name + (copy ? " (salinan)" : "") : "",
    workType: !item
      ? undefined
      : item.pattern_type !== "weekly" ||
          working.length === 0 ||
          working.some((day) => day.sessions.length > 1 || day.sessions[0]?.rules.type !== "fixed")
        ? "legacy"
        : "fixed",
    shifts: [{ name: "", rules: emptyRules() }],
    isActive: item?.is_active ?? true,
    patternType: item?.pattern_type || "weekly",
    cycleDays: item?.cycle_days || 7,
    calendarId: item?.calendar_id || null,
    holidayPolicy: item?.calendar_id ? item.holiday_policy : undefined,
    days,
    workingDays: working.map((d) => d.day),
    sharedRules: first,
    differentDays: !simple,
    customDays: working
      .filter(
        (d) =>
          d.sessions.length !== 1 || JSON.stringify(d.sessions[0].rules) !== JSON.stringify(first),
      )
      .map((d) => d.day),
  };
}
export function templatePayload(values, original) {
  const v = values;
  let days = v.days;
  if (v.patternType === "weekly") days = weeklyScheduleDays(values);
  return {
    name: v.name,
    isActive: v.isActive,
    patternType: v.patternType,
    cycleDays: v.patternType === "weekly" ? 7 : v.cycleDays,
    calendarId: v.calendarId || null,
    holidayPolicy: v.calendarId ? v.holidayPolicy : "roster",
    days: days.map((d) => ({
      day: d.day,
      sessions: d.sessions.map((s, index) => {
        const prior = original?.days?.find((x) => x.day === d.day)?.sessions[index];
        // Referensi existing mempertahankan seluruh revisi efektif, termasuk mendatang.
        if (prior?.shiftId && JSON.stringify(prior.rules) === JSON.stringify(s.rules))
          return { shiftId: prior.shiftId };
        if (s.shiftId) return { shiftId: s.shiftId };
        const rules = { ...emptyRules(), ...s.rules };
        if (rules.type === "off") return { rules: { ...emptyRules(), type: "off" } };
        if (rules.type === "fixed")
          Object.assign(rules, {
            windowStart: null,
            windowEnd: null,
            latestFinish: null,
            requiredMinutes: 0,
          });
        else Object.assign(rules, { startTime: null, endTime: null });
        return { rules };
      }),
    })),
  };
}
export function shiftGroupPayload(values) {
  return {
    name: values.name,
    isActive: values.isActive,
    workingDays: values.workingDays || [],
    calendarId: values.calendarId || null,
    holidayPolicy: values.calendarId ? values.holidayPolicy : "roster",
    shifts: (values.shifts || []).map((shift) => ({
      name: shift.name,
      rules: { ...emptyRules(), ...shift.rules, type: "fixed" },
    })),
  };
}
