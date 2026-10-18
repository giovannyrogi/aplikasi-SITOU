import assert from "node:assert/strict";
import test from "node:test";
import { scopeRevisionFromState } from "../lib/access/scopeRevision.mjs";

const base = {
  organizationId: "1",
  membershipId: "9",
  locationMode: "all",
  locationIds: [],
  packages: [{ code: "inventory_stock", mode: "selected", moduleEnabled: true, warehouseIds: ["2", "3"] }],
};

test("revisi scope stabil ketika urutan lokasi dan gudang berubah", () => {
  const first = { ...base, locationMode: "selected", locationIds: ["6", "4"] };
  const reordered = {
    ...first,
    locationIds: ["4", "6"],
    packages: [{ ...base.packages[0], warehouseIds: ["3", "2"] }],
  };
  assert.equal(scopeRevisionFromState(first), scopeRevisionFromState(reordered));
  assert.equal(scopeRevisionFromState(base), scopeRevisionFromState({ ...base, locationIds: ["7"] }));
});

test("revisi berubah saat mode/lokasi HRD atau gudang dan paket Inventaris berubah", () => {
  const digest = scopeRevisionFromState(base);
  assert.notEqual(digest, scopeRevisionFromState({ ...base, locationMode: "selected", locationIds: ["4"] }));
  assert.notEqual(digest, scopeRevisionFromState({ ...base, packages: [{ ...base.packages[0], warehouseIds: ["2"] }] }));
  assert.notEqual(digest, scopeRevisionFromState({ ...base, packages: [{ ...base.packages[0], moduleEnabled: false }] }));
  assert.notEqual(digest, scopeRevisionFromState({ ...base, packages: [] }));
  assert.notEqual(digest, scopeRevisionFromState({ ...base, organizationId: "2" }));
  assert.notEqual(digest, scopeRevisionFromState({ ...base, membershipId: "10" }));
});
