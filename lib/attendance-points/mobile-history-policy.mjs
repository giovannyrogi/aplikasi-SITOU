import { addDays, localDate } from "../work-schedules/rules.mjs";

export function historySessions(events) {
  const sessions = new Map();
  for (const event of events) {
    // Preserve historical pairs that predate session IDs. The correction key
    // uses the first event; grouping must not split entry and exit by event ID.
    const key = JSON.stringify([event.workDate,event.dailyId,event.sessionId,event.outsideNo,event.context]);
    if (!sessions.has(key))
      sessions.set(key, { workDate: event.workDate, sessionKey: correctionSessionKey(event), evidence: event, arrival: null, departure: null });
    const entry = sessions.get(key);
    if (event.type === "check_in") entry.arrival ??= event;
    else entry.departure = event;
  }
  return [...sessions.values()].sort(
    (a, b) => b.workDate.localeCompare(a.workDate) || b.evidence.occurredAt - a.evidence.occurredAt,
  );
}

export function canRequestCorrection(entry, clock) {
  if (entry.evidence.correctionStatus === 'pending') return false;
  return entry.evidence.endsAt ? entry.evidence.endsAt <= clock.now : entry.workDate < clock.today;
}

export function correctionSessionKey(event) {
  if (event.sessionNo != null) return `scheduled:${event.sessionNo}`;
  if (event.context === 'outside_schedule') return `outside:${event.outsideNo}`;
  if (event.context === 'holiday_work') return 'holiday';
  return `legacy:${event.eventDate}:${event.id}`;
}

export function correctionDateBounds(entry, zone, today) {
  const min = localDate(entry.arrival.occurredAt, zone);
  const next = addDays(min, 1);
  return { min, max: next < today ? next : today };
}
