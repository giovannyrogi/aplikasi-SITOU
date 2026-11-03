import { addDays, dayNumber, makeSessions, assertNoOverlap } from "./rules.mjs";
import { patternAt } from "./definitionRevisions.mjs";

export const ALREADY_USED = "Sudah digunakan pada tanggal yang dipilih.";
export const TIME_CONFLICT = "Jam kerja bertabrakan.";
export const UNAVAILABLE = "Jam kerja belum dapat digunakan pada tanggal yang dipilih.";
export const shortUsageReason = (reason) =>
  reason === ALREADY_USED
    ? "Sudah digunakan"
    : reason === TIME_CONFLICT
      ? "Jam kerja bertabrakan"
      : reason;

/** Any selected employee/date using this choice makes the whole bulk choice unavailable. */
export function replacementUsageReason(choice, usage) {
  return choice && usage?.patternIds.includes(String(choice.patternId)) ? ALREADY_USED : "";
}

export function additionalUsageReason(choice, usage, from, until) {
  if (!choice || !usage || !from || !until) return "";
  if (usage.patternIds.includes(String(choice.patternId))) return ALREADY_USED;
  if (!usage.timezone || !usage.revisions || !usage.periods) return UNAVAILABLE;
  const candidates = [];
  for (let date = from; date <= until; date = addDays(date, 1)) {
    const dated = patternAt(
      {
        patterns: [
          {
            id: String(choice.patternId),
            pattern_type: "weekly",
            days:
              choice.days?.map((d) => ({
                day: d.day,
                shiftIds: d.sessions.map((s) => s.shiftId),
              })) || [],
          },
        ],
        definitionRevisions: usage.definitionRevisions,
      },
      choice.patternId,
      date,
    );
    const hasRevision = usage.definitionRevisions?.some(
      (r) => r.pattern_id === String(choice.patternId),
    );
    const ids = hasRevision
      ? choice.shiftId
        ? dated.days.flatMap((d) => d.shiftIds).slice(0, 1)
        : dated.days.find((d) => d.day === dayNumber(date, dated, from))?.shiftIds || []
      : choice.shiftId
        ? [choice.shiftId]
        : choice.days
            ?.find((day) => day.day === dayNumber(date, { pattern_type: "weekly" }, from))
            ?.sessions.map((s) => s.shiftId) || [];
    if (!ids.length) return UNAVAILABLE;
    try {
      const shifts = ids.map((id) => {
        const revision = usage.revisions.findLast(
          (r) => r.shiftId === String(id) && r.from <= date && (!r.until || r.until >= date),
        );
        if (!revision || revision.rules.type === "off") throw new Error("No working hours");
        return { id, revision_id: revision.id, rules: revision.rules };
      });
      candidates.push(...makeSessions(date, shifts, usage.timezone));
    } catch (failure) {
      return failure.code === "SESSION_OVERLAP" ? TIME_CONFLICT : UNAVAILABLE;
    }
  }
  try {
    assertNoOverlap(candidates);
  } catch {
    return TIME_CONFLICT;
  }
  if (
    candidates.some((candidate) =>
      usage.periods.some(
        (period) =>
          Date.parse(candidate.startsAt) < Date.parse(period.endsAt) &&
          Date.parse(candidate.endsAt) > Date.parse(period.startsAt),
      ),
    )
  )
    return TIME_CONFLICT;
  return "";
}
