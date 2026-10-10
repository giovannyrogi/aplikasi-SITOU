import test from "node:test";
import assert from "node:assert/strict";
import { grantKey, hasScope } from "../lib/access/packagePolicy.mjs";
import {
  warehouseSchema,
  warehouseUpdateSchema,
  moduleUpdateSchema,
} from "../lib/inventory/schemas.js";
import { accountUpdateSchema } from "../lib/access/schemas.js";
import { catalogSchemas, itemWarehouseSchema } from "../lib/inventory/catalogSchemas.js";
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
test("katalog menormalisasi kode dan tidak menerima saldo atau file ID dari browser", () => {
  const value = { organizationId: 1, code: " atk ", name: "ATK", isActive: true };
  assert.equal(catalogSchemas.categories.parse(value).code, "ATK");
  const item = { ...value, categoryId: 1, unitId: 1 };
  assert.equal(catalogSchemas.items.safeParse({ ...item, stock: 100 }).success, false);
  assert.equal(catalogSchemas.items.safeParse({ ...item, photoFileId: 20 }).success, false);
});
test("batas minimum finite nonnegative dan maksimal tiga desimal tanpa saldo stok", () => {
  const value = {
    organizationId: 1,
    warehouseId: 1,
    minimumStock: 0.125,
    isActive: true,
    version: 0,
  };
  assert.equal(itemWarehouseSchema.safeParse(value).success, true);
  for (const number of [-1, Infinity, NaN, 0.1234])
    assert.equal(itemWarehouseSchema.safeParse({ ...value, minimumStock: number }).success, false);
});

test("tautan lama inventaris mempertahankan konteks valid dan menolak parameter asing", async () => {
  const { inventoryLegacyDestination } = await import("../lib/inventory/navigation.mjs");
  for (const kind of ["items", "categories", "units", "warehouses"])
    assert.equal(
      inventoryLegacyDestination("catalog", {
        tab: kind,
        organizationId: "7",
        next: "https://example.com",
      }),
      `/master-data/inventory-${kind}?organizationId=7`,
    );
  assert.equal(
    inventoryLegacyDestination("master-data", { tab: "../bad", organizationId: "-1" }),
    "/master-data/inventory-items",
  );
  assert.equal(
    inventoryLegacyDestination("reports", { organizationId: ["7", "8"] }),
    "/reports/inventory-distribution",
  );
});

test("satuan menerima nama tanpa kode; kode kategori dan barang tetap wajib", () => {
  const input = { organizationId: 1, name: "Buah", isActive: true, allowsFractional: false };
  assert.equal(catalogSchemas.units.safeParse(input).success, true);
  assert.equal(catalogSchemas.units.safeParse({ ...input, name: " " }).success, false);
  assert.equal(
    catalogSchemas.categories.safeParse({ organizationId: 1, name: "ATK", isActive: true }).success,
    false,
  );
  assert.equal(
    catalogSchemas.items.safeParse({
      organizationId: 1,
      name: "Kertas",
      isActive: true,
      categoryId: 1,
      unitId: 1,
    }).success,
    false,
  );
});

test("label akses inventaris menjelaskan Lihat Saja dan kemampuan Pengelola", async () => {
  const { accessFeatureLabel, accessFeatureDescription } =
    await import("../lib/access/featureLabels.mjs");
  assert.equal(accessFeatureLabel("inventory_reader"), "Fitur Inventaris — Lihat Saja");
  assert.match(accessFeatureDescription("inventory_reader"), /Tidak dapat mengubah/);
  assert.match(
    accessFeatureDescription("inventory_master"),
    /Mengelola barang, kategori, satuan, dan gudang/,
  );
});

test("master inventaris berscope organisasi dan bisa digabung tiga akses berbeda", () => {
  const value = {
    username: "uji_master",
    employeeId: 1,
    version: "2026-10-09T00:00:00Z",
    packageAccess: [
      { packageCode: "inventory_reader", scopeMode: "selected", warehouseIds: [1] },
      { packageCode: "inventory_manager", scopeMode: "selected", warehouseIds: [2] },
      { packageCode: "inventory_master", scopeMode: "all", warehouseIds: [] },
    ],
  };
  assert.equal(accountUpdateSchema.safeParse(value).success, true);
  assert.equal(
    accountUpdateSchema.safeParse({
      ...value,
      packageAccess: [
        { packageCode: "inventory_master", scopeMode: "selected", warehouseIds: [1] },
      ],
    }).success,
    false,
  );
});
