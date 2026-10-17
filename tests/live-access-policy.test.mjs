import assert from "node:assert/strict";
import test from "node:test";
import { accessChangeImpact, pageAccessState } from "../lib/access/liveAccessPolicy.mjs";

const hrd = (grants) => ({ hris: { configured: true, fullAdmin: false, grants }, permissions: [] });
const inventory = (read, writes = []) => ({
  permissions: read ? ["inventory.master.read"] : [],
  writePermissions: writes,
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
