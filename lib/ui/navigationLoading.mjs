export const NAVIGATION_TIMEOUT_MS = 30_000;

/** Pemulihan hanya untuk tujuan internal yang sudah dipilih pengguna. */
export function navigationRecoveryHref(href, origin) {
  if (typeof href !== "string" || !href.startsWith("/") || href.startsWith("//")) return null;
  try {
    const target = new URL(href, origin);
    return target.origin === origin && !target.username && !target.password ? target.href : null;
  } catch {
    return null;
  }
}
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
