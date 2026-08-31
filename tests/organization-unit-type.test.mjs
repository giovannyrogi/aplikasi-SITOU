import assert from "node:assert/strict";
import test from "node:test";
import {
  organizationUnitCreateSchema,
  organizationUnitTypeCreateSchema,
} from "../lib/master-data/schemas.js";
import {
  canAssignOrganizationUnitType,
  isOrganizationUnitTypeCodeLocked,
} from "../lib/master-data/organizationUnitTypeRules.mjs";

test("schema jenis unit menormalisasi kode uppercase", () => {
  const result = organizationUnitTypeCreateSchema.parse({
    organizationId: "1",
    code: "direksi_utama",
    name: "Direksi Utama",
    description: "Organ eksekutif.",
    sortOrder: "10",
    isActive: true,
  });
  assert.equal(result.code, "DIREKSI_UTAMA");
  assert.equal(result.sortOrder, 10);
});

test("schema jenis unit menolak tanda hubung dan urutan negatif", () => {
  assert.equal(
    organizationUnitTypeCreateSchema.safeParse({
      organizationId: 1,
      code: "DIREKSI-UTAMA",
      name: "Direksi Utama",
      sortOrder: -1,
      isActive: true,
    }).success,
    false,
  );
});

test("schema Divisi dan Unit hanya menerima unitTypeId", () => {
  const result = organizationUnitCreateSchema.safeParse({
    organizationId: 1,
    parentUnitId: null,
    code: "DIV_SDM",
    name: "Divisi SDM",
    unitTypeId: 9,
    locations: [],
    isActive: true,
  });
  assert.equal(result.success, true);
  assert.equal(result.data.unitTypeId, 9);
});

test("kode terkunci hanya setelah jenis digunakan", () => {
  assert.equal(
    isOrganizationUnitTypeCodeLocked({ usageCount: 2, currentCode: "DIV", nextCode: "DIVISI" }),
    true,
  );
  assert.equal(
    isOrganizationUnitTypeCodeLocked({ usageCount: 0, currentCode: "DIV", nextCode: "DIVISI" }),
    false,
  );
});

test("jenis nonaktif hanya dapat dipertahankan pada unit yang sama", () => {
  assert.equal(
    canAssignOrganizationUnitType({ isActive: false, typeId: 5, currentTypeId: 5 }),
    true,
  );
  assert.equal(
    canAssignOrganizationUnitType({ isActive: false, typeId: 5, currentTypeId: 7 }),
    false,
  );
  assert.equal(canAssignOrganizationUnitType({ isActive: true, typeId: 5 }), true);
});

test("schema Divisi dan Unit menerima tanggal eksplisit per lokasi", () => {
  const result = organizationUnitCreateSchema.safeParse({
    organizationId: 1,
    parentUnitId: null,
    code: "DIV_IT",
    name: "Teknologi & Informatika",
    unitTypeId: 9,
    locations: [
      { locationId: 1, activeFrom: "2020-01-01" },
      { locationId: 2, activeFrom: "2021-06-01" },
    ],
    isActive: true,
  });
  assert.equal(result.success, true);
  assert.equal(result.data.locations[1].activeFrom, "2021-06-01");
});

test("schema Divisi dan Unit menolak payload locationIds lama dan lokasi duplikat", () => {
  assert.equal(
    organizationUnitCreateSchema.safeParse({
      organizationId: 1,
      code: "DIV_LAMA",
      name: "Payload Lama",
      unitTypeId: 9,
      locationIds: [1],
      isActive: true,
    }).success,
    false,
  );
  assert.equal(
    organizationUnitCreateSchema.safeParse({
      organizationId: 1,
      code: "DIV_DUPLIKAT",
      name: "Lokasi Duplikat",
      unitTypeId: 9,
      locations: [
        { locationId: 1, activeFrom: "2020-01-01" },
        { locationId: 1, activeFrom: "2021-01-01" },
      ],
      isActive: true,
    }).success,
    false,
  );
});