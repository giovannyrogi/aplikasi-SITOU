/** Only the most recent open attendance period can accept a check-out. */
export function enforceOpenAttendance(sessions) {
  const open = sessions
    .filter((session) => session.entered && !session.exited && !session.missedExit)
    .sort((a, b) => Date.parse(b.entered) - Date.parse(a.entered))[0];
  if (!open) return;
  for (const session of sessions) {
    session.actions =
      session === open ? session.actions.filter((action) => action === "check_out") : [];
  }
}
