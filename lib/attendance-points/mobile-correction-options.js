import { createHash } from 'node:crypto';
import { ServiceError } from '@/lib/api/routeHelpers';
import { context } from '@/lib/work-schedules/repository';
import { resolveDays } from '@/lib/work-schedules/service';
import { addDays, localDate } from '@/lib/work-schedules/rules.mjs';
import { attendanceEventsFor } from './mobile-history-repository';
import { historySessions } from './mobile-history-policy.mjs';

export const correctionHash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

// Reuse the authoritative resolver, including special schedules and frozen days.
// A request snapshots its basis, never invents an attendance event or a schedule.
export async function correctionOptions(db, actor, clock, workDate) {
  if (workDate < clock.firstDate || workDate > clock.today)
    throw new ServiceError('VALIDATION_ERROR','Pilih tanggal dalam masa kerja Anda.',422,
      { workDate: 'Pilih tanggal dalam masa kerja Anda.' });
  const ctx=await context(db,actor.organization_id);
  const days=await resolveDays(db, actor.organization_id,actor.ids[1],workDate,workDate,ctx,clock.timezone);
  const entries=historySessions(await attendanceEventsFor(db,actor,workDate,addDays(workDate,1)));
  const requests=await db.query(`SELECT session_key,status FROM attendance_correction_requests
      WHERE organization_id=$1 AND employee_id=$2 AND work_date=$3 AND status='pending'`,
    [...actor.ids,workDate]);
  const day = days[0];
  const sessions = (day?.sessions || []).map((s) => ({
    sessionKey: `scheduled:${s.sessionNo}`, name: s.name, startsAt: s.startsAt, endsAt: s.endsAt,
    rules: s.rules, context: 'scheduled',
    entry: entries.find((e) => e.sessionKey === `scheduled:${s.sessionNo}`),
  }));
  for (const entry of entries) {
    if (sessions.some((s) => s.sessionKey === entry.sessionKey)) continue;
    sessions.push({ sessionKey: entry.sessionKey, name: entry.evidence.shiftName,
      startsAt: entry.evidence.startsAt, endsAt: entry.evidence.endsAt,
      context: entry.evidence.context, entry });
  }
  return sessions.map((s) => {
    const basis = {
      workDate, sessionKey: s.sessionKey, timezone: clock.timezone,
      startsAt: s.startsAt ? new Date(s.startsAt).toISOString() : null,
      endsAt: s.endsAt ? new Date(s.endsAt).toISOString() : null,
      rules: s.rules ?? null, context: s.context,
      arrival: s.entry?.arrival ? { id:s.entry.arrival.id,eventDate:s.entry.arrival.eventDate,
        occurredAt:new Date(s.entry.arrival.occurredAt).toISOString() } : null,
      departure: s.entry?.departure ? { id:s.entry.departure.id,eventDate:s.entry.departure.eventDate,
        occurredAt:new Date(s.entry.departure.occurredAt).toISOString() } : null,
    };
    const pending = requests.rows.some((r) => r.session_key === s.sessionKey);
    const ended = s.endsAt ? new Date(s.endsAt) <= clock.now : workDate < clock.today;
    const endDate = basis.endsAt ? localDate(new Date(basis.endsAt),clock.timezone) : addDays(workDate,1);
    const maxDate = endDate > workDate ? endDate : addDays(workDate,1);
    return { ...s, basis, version:correctionHash(basis), pending,
      available: ended && !pending,
      firstDate:workDate, lastDate:maxDate < clock.today ? maxDate : clock.today };
  });
}
