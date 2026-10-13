import assert from "node:assert/strict";
import test from "node:test";
import { scheduleNavigationDeadline, NAVIGATION_TIMEOUT_MS } from "../lib/ui/navigationLoading.mjs";
function clock() {
  const callbacks = [];
  const cleared = [];
  return {
    callbacks,
    cleared,
    setTimer: (fn, ms) => {
      callbacks.push({ fn, ms });
      return callbacks.length - 1;
    },
    clearTimer: (id) => cleared.push(id),
  };
}
test("navigasi yang tidak selesai memiliki deadline tanpa menutup token upload", () => {
  const timers = clock();
  const navigation = Symbol("navigation");
  const upload = Symbol("upload");
  const active = new Set([navigation, upload]);
  scheduleNavigationDeadline(navigation, (token) => active.delete(token), timers);
  assert.equal(timers.callbacks[0].ms, NAVIGATION_TIMEOUT_MS);
  timers.callbacks[0].fn();
  assert.deepEqual([...active], [upload]);
});
test("navigasi selesai atau dibatalkan tidak memicu peringatan terlambat", () => {
  const timers = clock();
  let calls = 0;
  const cancel = scheduleNavigationDeadline("old", () => calls++, timers);
  cancel();
  cancel();
  timers.callbacks[0].fn();
  assert.equal(calls, 0);
  assert.deepEqual(timers.cleared, [0]);
});
test("timer navigasi lama tidak mengakhiri navigasi penggantinya", () => {
  const timers = clock();
  const expired = [];
  const cancel = scheduleNavigationDeadline("old", (token) => expired.push(token), timers);
  cancel();
  scheduleNavigationDeadline("new", (token) => expired.push(token), timers);
  timers.callbacks[0].fn();
  assert.deepEqual(expired, []);
  timers.callbacks[1].fn();
  timers.callbacks[1].fn();
  assert.deepEqual(expired, ["new"]);
});
