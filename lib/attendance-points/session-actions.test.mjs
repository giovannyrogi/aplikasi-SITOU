import test from "node:test";
import assert from "node:assert/strict";
import { enforceOpenAttendance } from "./session-actions.mjs";
import { nextOutsideScheduleSession } from "./outside-schedule.mjs";

test("overnight attendance blocks next-date and holiday check-in until checkout", () => {
  const open = {
    workDate: "2026-11-10",
    sessionNo: 2,
    entered: "2026-11-10T23:55:00+08:00",
    actions: ["check_out"],
  };
  const next = { workDate: "2026-11-11", sessionNo: 1, actions: ["check_in"] };
  const holiday = { ...next, sessionNo: 2, holidayWork: true, actions: ["check_in"] };
  enforceOpenAttendance([open, next, holiday]);
  assert.deepEqual(open.actions, ["check_out"]);
  assert.deepEqual(next.actions, []);
  assert.deepEqual(holiday.actions, []);
  assert.equal(
    nextOutsideScheduleSession(
      {
        date: next.workDate,
        status: "scheduled",
        sessions: [{ endsAt: "2026-11-11T17:00:00+08:00" }],
      },
      [open, next, holiday],
      new Date("2026-11-11T22:00:00+08:00"),
    ),
    null,
  );
});

test("checkout releases next work date even when its session number is the same", () => {
  const previous = {
    workDate: "2026-11-10",
    sessionNo: 1,
    entered: "2026-11-10T23:55:00+08:00",
    exited: "2026-11-11T01:00:00+08:00",
    actions: [],
  };
  const next = { workDate: "2026-11-11", sessionNo: 1, actions: ["check_in"] };
  enforceOpenAttendance([previous, next]);
  assert.deepEqual(next.actions, ["check_in"]);
});

test("read-only actions cannot be elevated and historical missed checkout is preserved", () => {
  const legacy = { entered: "2026-11-09T10:00:00+08:00", missedExit: true, actions: [] };
  const open = { entered: "2026-11-10T23:55:00+08:00", actions: [] };
  const next = { actions: [] };
  enforceOpenAttendance([legacy, open, next]);
  assert.deepEqual(open.actions, []);
  assert.deepEqual(next.actions, []);
  assert.equal(legacy.missedExit, true);
});
