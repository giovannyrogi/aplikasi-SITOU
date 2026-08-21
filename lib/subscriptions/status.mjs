const MANUAL_STATUSES = new Set(["suspended", "cancelled"]);

export function getEffectiveSubscriptionStatus({
  storedStatus,
  startsOn,
  endsOn,
  graceEndsOn,
  today,
}) {
  if (MANUAL_STATUSES.has(storedStatus)) return storedStatus;
  if (today < startsOn) return "scheduled";
  if (today <= endsOn) return "active";
  if (graceEndsOn && today <= graceEndsOn) return "grace";
  return "expired";
}

export function subscriptionAllowsAccess(status) {
  return status === "active" || status === "grace";
}
