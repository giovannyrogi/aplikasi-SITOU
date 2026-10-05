import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/** Memuat kebijakan bersama tanpa resolver alias Next.js pada runtime unit test. */
async function loadRoutePolicy(filename) {
  const source = readFileSync(new URL(`../app/utils/${filename}`, import.meta.url), "utf8")
    .replace("@/app/constants/roles", new URL("../app/constants/roles.js", import.meta.url).href);
  return import(`data:text/javascript,${encodeURIComponent(source)}`);
}
const { getDefaultRouteByRole } = await loadRoutePolicy("defaultRouteByRole.js");
const { getAllowedRolesForPath } = await loadRoutePolicy("protectedRoutes.js");

test("seluruh role memakai rute dashboard terpusat", () => {
  for (const role of ["employee", "hrd", "leader", "superadmin"])
    assert.equal(getDefaultRouteByRole(role), "/dashboard");
});

test("rute dashboard tidak memberikan akses modul organisasi kepada Pegawai", () => {
  assert.deepEqual(getAllowedRolesForPath("/employee-dashboard"), ["employee"]);
  assert.ok(getAllowedRolesForPath("/dashboard").includes("employee"));
  for (const path of ["/employees", "/access/accounts", "/leave-requests", "/reports"])
    assert.ok(!getAllowedRolesForPath(path).includes("employee"), path);
  for (const role of ["hrd", "leader", "superadmin"])
    assert.ok(getAllowedRolesForPath("/dashboard").includes(role));
});
