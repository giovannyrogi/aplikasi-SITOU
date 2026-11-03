import test from "node:test";
import assert from "node:assert/strict";
import {
  additionalUsageReason,
  replacementUsageReason,
  ALREADY_USED,
  TIME_CONFLICT,
  UNAVAILABLE,
} from "./additionalUsage.mjs";
import { makeSessions } from "./rules.mjs";
const from = "2026-11-03",
  until = from,
  timezone = "Asia/Makassar";
const rules = (startTime, endTime, nextDay = false) => ({
  type: "fixed",
  startTime,
  endTime,
  nextDay,
  breakMinutes: 0,
  deductBreak: true,
  requiredMinutes: 0,
  lateTolerance: 0,
  earlyTolerance: 0,
});
const r = (id, shiftId, start, end, nextDay = false) => ({
  id,
  shiftId,
  from: "2026-01-01",
  until: null,
  rules: rules(start, end, nextDay),
});
const revisions = [
  r("1", "1", "09:00", "17:00"),
  r("2", "2", "09:00", "17:00"),
  r("3", "3", "18:00", "20:00"),
];
const periods = makeSessions(
  from,
  [{ id: "1", revision_id: "1", rules: revisions[0].rules }],
  timezone,
);
const usage = { patternIds: ["10"], timezone, revisions, periods, days: [] };
const choice = (patternId, shiftId) => ({ patternId, shiftId });

test("dated schedule definitions choose the actual hours on each target date", () => {
  const data = {
    ...usage,
    definitionRevisions: [
      {
        pattern_id: "13",
        effective_from: "-infinity",
        pattern_type: "weekly",
        days: [
          { day: 2, shiftIds: ["1"] },
          { day: 3, shiftIds: ["1"] },
        ],
      },
      {
        pattern_id: "13",
        effective_from: "2026-11-04",
        pattern_type: "weekly",
        days: [
          { day: 2, shiftIds: ["3"] },
          { day: 3, shiftIds: ["3"] },
        ],
      },
    ],
  };
  assert.equal(additionalUsageReason(choice("13", "1"), data, from, until), TIME_CONFLICT);
  const next = {
    ...data,
    periods: makeSessions(
      "2026-11-04",
      [{ id: "1", revision_id: "1", rules: revisions[0].rules }],
      timezone,
    ),
  };
  assert.equal(additionalUsageReason(choice("13", "1"), next, "2026-11-04", "2026-11-04"), "");
});

test("replacement blocks exact assigned patterns, not copies or overlapping replacement hours", () => {
  assert.equal(replacementUsageReason(choice("10", "1"), usage), ALREADY_USED);
  assert.equal(replacementUsageReason(choice("11", "1"), usage), "");
  assert.equal(replacementUsageReason(choice("12", "2"), usage), "");
  assert.equal(replacementUsageReason(choice("13", "3"), usage), "");
  assert.equal(replacementUsageReason(null, usage), "");
  assert.equal(replacementUsageReason(choice("10", "1"), null), "");
});
test("only the assigned schedule has Already used, even when copies share shift IDs", () => {
  assert.equal(additionalUsageReason(choice("10", "1"), usage, from, until), ALREADY_USED);
  assert.equal(additionalUsageReason(choice("11", "1"), usage, from, until), TIME_CONFLICT);
  assert.equal(additionalUsageReason(choice("12", "2"), usage, from, until), TIME_CONFLICT);
});
test("nonoverlapping hours remain available, touching endpoints allowed", () => {
  assert.equal(additionalUsageReason(choice("13", "3"), usage, from, until), "");
  const touching = { ...usage, revisions: [r("3", "3", "17:00", "19:00")] };
  assert.equal(additionalUsageReason(choice("13", "3"), touching, from, until), "");
});
test("effective revisions on target date override today display hours", () => {
  const data = {
    ...usage,
    revisions: [
      { ...r("3", "3", "18:00", "20:00"), until: "2026-11-03" },
      { ...r("4", "3", "09:00", "17:00"), from: "2026-11-04" },
    ],
  };
  assert.equal(additionalUsageReason(choice("13", "3"), data, from, until), "");
  const next = {
    ...data,
    periods: makeSessions(
      "2026-11-04",
      [{ id: "1", revision_id: "1", rules: revisions[0].rules }],
      timezone,
    ),
  };
  assert.equal(
    additionalUsageReason(choice("13", "3"), next, "2026-11-04", "2026-11-04"),
    TIME_CONFLICT,
  );
});
test("previous-night and next-day schedules are checked", () => {
  const prior = {
    ...usage,
    periods: makeSessions(
      "2026-11-02",
      [{ id: "4", revision_id: "4", rules: rules("23:00", "10:00", true) }],
      timezone,
    ),
  };
  assert.equal(additionalUsageReason(choice("12", "2"), prior, from, until), TIME_CONFLICT);
  const night = {
    ...usage,
    revisions: [r("4", "4", "23:00", "10:00", true)],
    periods: makeSessions(
      "2026-11-04",
      [{ id: "1", revision_id: "1", rules: revisions[0].rules }],
      timezone,
    ),
  };
  assert.equal(additionalUsageReason(choice("14", "4"), night, from, until), TIME_CONFLICT);
});
test("weekly source uses correct weekday; incomplete data fail closed", () => {
  const weekly = {
    patternId: "13",
    days: [
      { day: 2, sessions: [{ shiftId: "3" }] },
      { day: 3, sessions: [{ shiftId: "2" }] },
    ],
  };
  assert.equal(additionalUsageReason(weekly, usage, from, until), "");
  assert.equal(additionalUsageReason(weekly, usage, "2026-11-05", "2026-11-05"), UNAVAILABLE);
  assert.equal(additionalUsageReason(choice("13", "999"), usage, from, until), UNAVAILABLE);
  assert.equal(additionalUsageReason(weekly, null, from, until), "");
});
