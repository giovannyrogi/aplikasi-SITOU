import test from "node:test";
import assert from "node:assert/strict";
import { grantKey, hasScope } from "../lib/access/packagePolicy.mjs";
import {
  warehouseSchema,
  warehouseUpdateSchema,
  moduleUpdateSchema,
} from "../lib/inventory/schemas.js";
import { accountUpdateSchema } from "../lib/access/schemas.js";
test("cakupan gudang eksplisit dan identitas grant tidak bergantung urutan", () => {
  assert.equal(hasScope([], 1), false);
  assert.equal(hasScope(null, 1), true);
  assert.equal(hasScope(["2"], 1), false);
  assert.equal(hasScope(["2"], 2), true);
  assert.equal(
    grantKey({ packageCode: "inventory_reader", scopeMode: "selected", warehouseIds: [1, 2] }),
    grantKey({ packageCode: "inventory_reader", scopeMode: "selected", warehouseIds: ["2", "1"] }),
  );
});
test("schema gudang menormalisasi kode dan menolak versi/field asing", () => {
  const value = {
    organizationId: 1,
    locationId: 2,
    code: " b-01 ",
    name: "Gudang Cabang",
    isActive: true,
  };
  assert.equal(warehouseSchema.parse(value).code, "B-01");
  assert.equal(warehouseUpdateSchema.safeParse(value).success, false);
  assert.equal(warehouseSchema.safeParse({ ...value, code: "../gudang" }).success, false);
  assert.equal(warehouseSchema.safeParse({ ...value, stock: 10 }).success, false);
  assert.equal(
    moduleUpdateSchema.safeParse({ organizationId: 1, isEnabled: true, version: 0 }).success,
    true,
  );
});
test("payload akun lama mempertahankan paket dan scope paket baru divalidasi", () => {
  const value = {
    organizationId: 1,
    employeeId: 2,
    username: "pegawai_uji",
    roleCode: "employee",
    version: "2026-10-08T00:00:00Z",
  };
  assert.equal(accountUpdateSchema.parse(value).packageAccess, undefined);
  assert.deepEqual(accountUpdateSchema.parse({ ...value, packageAccess: [] }).packageAccess, []);
  const grant = { packageCode: "inventory_reader", scopeMode: "selected", warehouseIds: [1] };
  assert.equal(
    accountUpdateSchema.safeParse({ ...value, packageAccess: [grant, { ...grant }] }).success,
    false,
  );
  assert.equal(
    accountUpdateSchema.safeParse({ ...value, packageAccess: [{ ...grant, warehouseIds: [] }] })
      .success,
    false,
  );
  assert.equal(
    accountUpdateSchema.safeParse({ ...value, packageAccess: [{ ...grant, scopeMode: "all" }] })
      .success,
    false,
  );
  assert.equal(
    accountUpdateSchema.safeParse({
      ...value,
      packageAccess: [{ ...grant, packageCode: "superadmin" }],
    }).success,
    false,
  );
});
