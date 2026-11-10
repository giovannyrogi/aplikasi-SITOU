export const FIRST_OUTSIDE_SESSION = 17;
export const LAST_OUTSIDE_SESSION = 32;

function makeSession(sessionNo) {
  return {
    sessionNo,
    name: "Di luar jadwal",
    startsAt: null,
    endsAt: null,
    outsideSchedule: true,
    rules: { type: "outside_schedule" },
  };
}

export function outsideScheduleSessions(events) {
  const numbers = [...new Set(events.map((event) => event.outside_schedule_session_no).filter(Number.isInteger))];
  return numbers.sort((a, b) => a - b).map(makeSession);
}

export function nextOutsideScheduleSession(day, sessions, now) {
  if (day?.status !== "scheduled" || !day.sessions.length ||
      day.sessions.some((session) => now < new Date(session.endsAt)) ||
      sessions.some((session) => session.actions.includes("check_out") || session.actions.includes("check_in")))
    return null;
  const number = Math.max(FIRST_OUTSIDE_SESSION - 1, ...sessions
    .filter((session) => session.outsideSchedule && session.workDate === day.date)
    .map((session) => session.sessionNo)) + 1;
  return number <= LAST_OUTSIDE_SESSION
    ? { ...makeSession(number), workDate: day.date, actions: ["check_in"], missedExit: false }
    : null;
}
