export const NAVIGATION_TIMEOUT_MS = 30_000;
/** Deadline milik satu navigasi; callback yang sudah dibatalkan tidak menyentuh navigasi baru. */
export function scheduleNavigationDeadline(
  token,
  expire,
  { setTimer = setTimeout, clearTimer = clearTimeout, timeoutMs = NAVIGATION_TIMEOUT_MS } = {},
) {
  let active = true;
  const timer = setTimer(() => {
    if (!active) return;
    active = false;
    expire(token);
  }, timeoutMs);
  return () => {
    if (!active) return;
    active = false;
    clearTimer(timer);
  };
}
