import test from "node:test";
import assert from "node:assert/strict";
import { resolveOrganizationScope } from "../lib/auth/organizationScope.mjs";

test("HRD selalu memakai organisasi dari session", () => {
  assert.deepEqual(resolveOrganizationScope({ roleCode: "hrd", sessionOrganizationId: "12" }), {
    organizationId: "12",
    error: null,
  });
});

test("HRD ditolak ketika meminta organisasi lain", () => {
  assert.equal(
    resolveOrganizationScope({
      roleCode: "hrd",
      sessionOrganizationId: "12",
      requestedOrganizationId: "99",
    }).error,
    "ORGANIZATION_FORBIDDEN",
  );
});

test("Superadmin boleh memfilter semua organisasi atau satu organisasi", () => {
  assert.deepEqual(
    resolveOrganizationScope({ roleCode: "superadmin", requestedOrganizationId: "99" }),
    { organizationId: "99", error: null },
  );
  assert.deepEqual(resolveOrganizationScope({ roleCode: "superadmin", optional: true }), {
    organizationId: null,
    error: null,
  });
});
