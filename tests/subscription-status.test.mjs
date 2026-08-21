import test from "node:test";
import assert from "node:assert/strict";
import {
  getEffectiveSubscriptionStatus,
  subscriptionAllowsAccess,
} from "../lib/subscriptions/status.mjs";

const period = {
  storedStatus: "scheduled",
  startsOn: "2026-08-01",
  endsOn: "2026-08-31",
  graceEndsOn: "2026-09-07",
};
test("status periode mengikuti batas tanggal inklusif", () => {
  assert.equal(getEffectiveSubscriptionStatus({ ...period, today: "2026-07-31" }), "scheduled");
  assert.equal(getEffectiveSubscriptionStatus({ ...period, today: "2026-08-01" }), "active");
  assert.equal(getEffectiveSubscriptionStatus({ ...period, today: "2026-08-31" }), "active");
  assert.equal(getEffectiveSubscriptionStatus({ ...period, today: "2026-09-01" }), "grace");
  assert.equal(getEffectiveSubscriptionStatus({ ...period, today: "2026-09-07" }), "grace");
  assert.equal(getEffectiveSubscriptionStatus({ ...period, today: "2026-09-08" }), "expired");
});
test("status manual mengalahkan tanggal", () => {
  assert.equal(
    getEffectiveSubscriptionStatus({ ...period, storedStatus: "suspended", today: "2026-08-15" }),
    "suspended",
  );
  assert.equal(
    getEffectiveSubscriptionStatus({ ...period, storedStatus: "cancelled", today: "2026-08-15" }),
    "cancelled",
  );
});
test("hanya active dan grace memberikan akses", () => {
  assert.equal(subscriptionAllowsAccess("active"), true);
  assert.equal(subscriptionAllowsAccess("grace"), true);
  for (const status of ["scheduled", "expired", "suspended", "cancelled"])
    assert.equal(subscriptionAllowsAccess(status), false);
});
