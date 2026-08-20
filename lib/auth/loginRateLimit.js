const MAX_FAILED_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const attempts = new Map();

const normalizeKey = (ipAddress, username) =>
  `${String(ipAddress || "unknown").trim()}::${String(username || "")
    .trim()
    .toLowerCase()}`;

const getActiveEntry = (key) => {
  const entry = attempts.get(key);
  if (!entry) return null;

  if (entry.resetAt <= Date.now()) {
    attempts.delete(key);
    return null;
  }

  return entry;
};

export function checkLoginRateLimit(ipAddress, username) {
  const entry = getActiveEntry(normalizeKey(ipAddress, username));
  if (!entry || entry.count < MAX_FAILED_ATTEMPTS) return { allowed: true, retryAfter: 0 };

  return {
    allowed: false,
    retryAfter: Math.max(1, Math.ceil((entry.resetAt - Date.now()) / 1000)),
  };
}

export function recordLoginFailure(ipAddress, username) {
  const key = normalizeKey(ipAddress, username);
  const entry = getActiveEntry(key);

  attempts.set(key, {
    count: (entry?.count || 0) + 1,
    resetAt: entry?.resetAt || Date.now() + WINDOW_MS,
  });
}

export function clearLoginFailures(ipAddress, username) {
  attempts.delete(normalizeKey(ipAddress, username));
}
