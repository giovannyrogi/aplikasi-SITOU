import assert from "node:assert/strict";
import test from "node:test";
import {
  accessChangeImpact,
  accessEntitlementsChanged,
  accessScopeChanged,
  dashboardSectionsChanged,
  pageAccessState,
} from "../lib/access/liveAccessPolicy.mjs";

const hrd = (grants) => ({ hris: { configured: true, fullAdmin: false, grants }, permissions: [] });
const inventory = (read, writes = []) => ({
  permissions: read ? ["inventory.master.read"] : [],
  writePermissions: writes,
});

test("perubahan cakupan terdeteksi meski izin menu dan bagian dashboard tetap sama", () => {
  const before = { scopeRevision: "scope-a", dashboardSections: ["employees"] };
  const after = { scopeRevision: "scope-b", dashboardSections: ["employees"] };
  assert.equal(dashboardSectionsChanged(before, after), false);
  assert.equal(accessScopeChanged(before, after), true);
  assert.equal(accessScopeChanged(after, { ...after }), false);
  assert.equal(accessScopeChanged({}, after), false);
});

test("pesan perubahan hak hanya muncul saat hak efektif berubah", () => {
  const before = {
    permissions: ["inventory.master.read"],
    dashboardSections: ["employees"],
    hris: { grants: [{ key: "employees", level: "read" }] },
  };
  assert.equal(accessEntitlementsChanged(before, { ...before, scopeRevision: "baru" }), false);
  assert.equal(
    accessEntitlementsChanged(before, { ...before, permissions: ["inventory.master.read", "inventory.stock.read"] }),
    true,
  );
  assert.equal(
    accessEntitlementsChanged(before, { ...before, hris: { grants: [{ key: "employees", level: "manage" }] } }),
    true,
  );
  assert.equal(
    accessEntitlementsChanged(before, { ...before, hris: { grants: [{ key: "employees", level: "read" }] } }),
    false,
  );
});

test("hak kelola HRIS yang dicabut menutup form tanpa mengusir pembaca", () => {
  const before = hrd([{ key: "master-positions", level: "manage" }]);
  const after = hrd([{ key: "master-positions", level: "read" }]);
  assert.equal(accessChangeImpact("hrd", "/master-data/positions", before, after), "read-only");
  assert.equal(pageAccessState("hrd", after, "/master-data/positions").canRead, true);
  assert.equal(accessChangeImpact("hrd", "/dashboard", before, after), null);
});

test("hak lihat yang dicabut mengharuskan pengalihan, termasuk halaman detail", () => {
  const before = hrd([{ key: "employees", level: "manage" }]);
  assert.equal(accessChangeImpact("hrd", "/employees/12", before, hrd([])), "redirect");
  assert.equal(accessChangeImpact("hrd", "/employees/12", hrd([]), before), null);
});

test("izin tulis Inventaris dipisahkan dari izin baca dan fitur lain", () => {
  const before = inventory(true, ["inventory.catalog.create", "inventory.catalog.update"]);
  const after = inventory(true, ["inventory.catalog.create"]);
  assert.equal(accessChangeImpact("hrd", "/master-data/inventory-items", before, after), "write-reduced");
  assert.equal(accessChangeImpact("hrd", "/master-data/inventory-items", before, inventory(true)), "read-only");
  assert.equal(accessChangeImpact("hrd", "/master-data/inventory-items", before, inventory(false)), "redirect");
  assert.equal(accessChangeImpact("hrd", "/master-data/positions", before, after), null);
});

test("perubahan sebagian bagian dashboard tetap meminta data baru", () => {
  const before = { dashboardSections: ["employees", "contracts", "leave"] };
  const after = { dashboardSections: ["employees", "contracts"] };
  assert.equal(pageAccessState("hrd", after, "/dashboard/staff").canRead, true);
  assert.equal(accessChangeImpact("hrd", "/dashboard/staff", before, after), null);
  assert.equal(dashboardSectionsChanged(before, after), true);
  assert.equal(dashboardSectionsChanged(after, { dashboardSections: ["employees", "contracts"] }), false);
  assert.equal(pageAccessState("hrd", { dashboardSections: [] }, "/dashboard/staff").canRead, false);
});
