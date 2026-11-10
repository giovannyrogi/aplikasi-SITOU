/** Latest applicable immutable definition, with legacy definitions as a fallback. */
export function patternAt(context, id, date) {
  const pattern = context.patterns.find((p) => p.id === String(id));
  if (!pattern) return null;
  const revision = context.definitionRevisions?.findLast(
    (r) =>
      r.pattern_id === String(id) && (r.effective_from === "-infinity" || r.effective_from <= date),
  );
  return revision ? { ...pattern, ...revision, id: pattern.id } : pattern;
}

export function patternDefinition(pattern) {
  return {
    pattern_type: pattern.pattern_type,
    cycle_days: pattern.cycle_days,
    calendar_id: pattern.calendar_id || null,
    holiday_policy: pattern.holiday_policy,
    allow_holiday_attendance: pattern.allow_holiday_attendance ?? false,
    days: pattern.days,
  };
}
