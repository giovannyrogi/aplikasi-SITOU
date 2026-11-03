import test from "node:test";
import assert from "node:assert/strict";
import { patternAt } from "./definitionRevisions.mjs";
const original = {
  pattern_type: "weekly",
  cycle_days: 7,
  calendar_id: null,
  holiday_policy: "roster",
  days: [{ day: 1, shiftIds: ["1"] }],
};
const next = {
  ...original,
  calendar_id: "2",
  holiday_policy: "calendar",
  days: [{ day: 1, shiftIds: ["3"] }],
};
const context = {
  patterns: [{ id: "5", name: "Reguler", is_active: true, ...next }],
  definitionRevisions: [
    { pattern_id: "5", effective_from: "-infinity", ...original },
    { pattern_id: "5", effective_from: "2026-11-05", ...next },
  ],
};
test("historical resolution keeps former days, hours references and calendar policy", () => {
  const prior = patternAt(context, "5", "2026-11-04");
  assert.deepEqual(prior.days, original.days);
  assert.equal(prior.calendar_id, null);
  assert.equal(prior.holiday_policy, "roster");
});
test("effective date inclusive, stable assigned identity and metadata", () => {
  const future = patternAt(context, "5", "2026-11-05");
  assert.deepEqual(future.days, next.days);
  assert.equal(future.calendar_id, "2");
  assert.equal(future.id, "5");
  assert.equal(future.name, "Reguler");
});
test("multiple revisions apply in order without rewriting prior dates", () => {
  const data = {
    ...context,
    definitionRevisions: [
      ...context.definitionRevisions,
      { pattern_id: "5", effective_from: "2026-12-01", ...original },
    ],
  };
  assert.equal(patternAt(data, "5", "2026-11-30").calendar_id, "2");
  assert.equal(patternAt(data, "5", "2026-12-01").calendar_id, null);
  assert.equal(patternAt(data, "5", "2026-01-01").calendar_id, null);
});
test("legacy without revisions and organization-scoped missing source", () => {
  assert.deepEqual(patternAt({ patterns: [{ id: "1", ...original }] }, "1", "2026-01-01"), {
    id: "1",
    ...original,
  });
  assert.equal(patternAt(context, "999", "2026-11-05"), null);
});
