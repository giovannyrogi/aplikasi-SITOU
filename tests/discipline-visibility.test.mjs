import test from "node:test";
import assert from "node:assert/strict";

import { canViewDraftDisciplinaryActions } from "../lib/discipline/visibility.mjs";

test("draft tindakan hanya terlihat oleh HRD dan Superadmin", () => {
  assert.equal(canViewDraftDisciplinaryActions({ role_code: "hrd" }), true);
  assert.equal(canViewDraftDisciplinaryActions({ role_code: "superadmin" }), true);
  assert.equal(canViewDraftDisciplinaryActions({ role_code: "leader" }), false);
  assert.equal(canViewDraftDisciplinaryActions({ role_code: "employee" }), false);
  assert.equal(canViewDraftDisciplinaryActions(null), false);
});
