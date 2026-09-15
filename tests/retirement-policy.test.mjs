import test from "node:test";
import assert from "node:assert/strict";
import { retirementPolicySchema } from "../lib/retirement-policy/schema.mjs";
import { buildReportQuery } from "../lib/reports/query.mjs";
import { normalizeReportFilters } from "../lib/reports/policy.mjs";

test("usia pensiun dan alasan divalidasi tanpa pembulatan diam-diam", () => {
  const base = { retirementAge: 60, version: 0, reason: "Kebijakan organisasi" };
  assert.ok(retirementPolicySchema.safeParse(base).success);
  for (const retirementAge of [null, "60", 17, 101, 58.5])
    assert.equal(retirementPolicySchema.safeParse({ ...base, retirementAge }).success, false);
  assert.equal(retirementPolicySchema.safeParse({ ...base, reason: " " }).success, false);
  assert.equal(retirementPolicySchema.safeParse({ ...base, organizationId: 2 }).success, false);
});

test("query memerlukan kebijakan eksplisit dan memakai parameter SQL", () => {
  const filters = normalizeReportFilters("retirements", {}, "2026-09-14");
  assert.throws(() => buildReportQuery("retirements", filters, "1", null, "2026-09-14", 10));
  const query = buildReportQuery("retirements", filters, "1", [], "2026-09-14", 10, null, 62);
  assert.ok(query.values.includes(62));
  assert.match(query.text, /make_interval\(years => \$\d+::int\)/);
});
