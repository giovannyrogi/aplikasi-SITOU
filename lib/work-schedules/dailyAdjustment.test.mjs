import test from "node:test";
import assert from "node:assert/strict";
import { adjustmentShiftIds, composeDailyAdjustment, hoursLabel } from "./dailyAdjustment.mjs";
import { makeSessions, assertNoOverlap } from "./rules.mjs";
import { bulkExceptionPreviewSchema } from "./schemas.mjs";

const timezone = "Asia/Makassar",
  date = "2026-11-03";
const shift = (id, startTime, endTime, nextDay = false) => ({
  id,
  revision_id: id,
  name: `Shift ${id}`,
  rules: {
    type: "fixed",
    startTime,
    endTime,
    nextDay,
    breakMinutes: 0,
    deductBreak: true,
    requiredMinutes: 0,
    lateTolerance: 0,
    earlyTolerance: 0,
  },
});
const morning = shift("1", "08:00", "16:00"),
  extra = shift("2", "18:00", "20:00");
const before = makeSessions(date, [morning], timezone);
const compose = (mode, shifts = [extra], prior = before) =>
  composeDailyAdjustment({
    date,
    before: prior,
    shifts,
    mode,
    timezone,
    employeeName: "Pegawai QA",
  });

test("addition preserves existing hours, replacement does not", () => {
  assert.deepEqual(
    compose("add").map((s) => s.shiftId),
    ["1", "2"],
  );
  assert.deepEqual(
    compose("replace").map((s) => s.shiftId),
    ["2"],
  );
  assert.equal(before.length, 1);
});
test("later addition retains the earlier addition and sorts hours", () => {
  const prior = compose("add");
  assert.deepEqual(
    compose("add", [shift("3", "21:00", "22:00")], prior).map((s) => s.shiftId),
    ["1", "2", "3"],
  );
});
test("overlap and duplicate additions are rejected with employee and date", () => {
  for (const s of [morning, shift("3", "15:00", "18:00")])
    assert.throws(
      () => compose("add", [s]),
      (e) =>
        e.code === "SESSION_OVERLAP" &&
        e.message.includes("Pegawai QA") &&
        e.message.includes(date),
    );
});
test("touching endpoints are allowed; an off day can receive working hours", () => {
  assert.equal(compose("add", [shift("3", "16:00", "18:00")]).length, 2);
  assert.equal(compose("add", [extra], []).length, 1);
});
test("weekly schedule follows each weekday; empty day never silently becomes leave", () => {
  const pattern = {
    pattern_type: "weekly",
    cycle_days: 7,
    days: [
      { day: 2, shiftIds: ["1"] },
      { day: 3, shiftIds: ["2"] },
    ],
  };
  assert.deepEqual(adjustmentShiftIds(pattern, date, date), ["1"]);
  assert.deepEqual(adjustmentShiftIds(pattern, "2026-11-04", date), ["2"]);
  assert.throws(() => adjustmentShiftIds(pattern, "2026-11-08", date), /tidak memiliki jam kerja/);
  assert.deepEqual(adjustmentShiftIds(pattern, "2026-11-08", date, "9"), ["9"]);
});
test("group alternatives are not combined; rotation without an anchor is rejected", () => {
  assert.deepEqual(adjustmentShiftIds({}, date, date, "7"), ["7"]);
  assert.throws(() => adjustmentShiftIds({ pattern_type: "rotation" }, date, date), /rotasi/);
});
test("cross-midnight clashes against next day are rejected", () => {
  const night = compose("replace", [shift("3", "23:00", "09:00", true)]);
  const next = makeSessions("2026-11-04", [morning], timezone);
  assert.throws(() => assertNoOverlap([...night, ...next]), /bertabrakan/);
  assert.equal(hoursLabel(night[0].rules), "23:00–09:00 besok");
});
test("invalid off choice and more than 16 resulting periods rejected", () => {
  assert.throws(
    () => compose("replace", [{ ...extra, rules: { type: "off" } }]),
    /bukan jadwal libur/,
  );
  assert.throws(() => compose("add", [extra], Array(16).fill(before[0])), /melebihi 16/);
});
test("request selects one pattern; legacy replace remains compatible", () => {
  const base = { organizationId: "1", employeeIds: ["2"], from: date, until: date };
  assert.equal(
    bulkExceptionPreviewSchema.parse({ ...base, patternId: "3", mode: "add" }).mode,
    "add",
  );
  assert.equal(bulkExceptionPreviewSchema.parse({ ...base, shiftIds: ["3"] }).mode, undefined);
  for (const change of [
    {},
    { patternId: "3", shiftIds: ["4"] },
    { shiftIds: [] },
    { mode: "add", shiftIds: ["3"] },
    { mode: "other", patternId: "3" },
  ])
    assert.equal(bulkExceptionPreviewSchema.safeParse({ ...base, ...change }).success, false);
});
