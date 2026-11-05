import { test } from "node:test";
import assert from "node:assert/strict";
import { catalogYearConflict, sameCatalogContents } from "./yearPolicy.mjs";

test("tahun baru tersedia, tahun terbit harus dibuka sebagai revisi eksplisit", () => {
  const published = { id: "7" };
  assert.equal(catalogYearConflict({}), null);
  assert.equal(catalogYearConflict({ published }).code, "CATALOG_YEAR_PUBLISHED");
  assert.equal(catalogYearConflict({ published, revisionOf: "7" }), null);
  assert.equal(catalogYearConflict({ published, revisionOf: "6" }).code, "CATALOG_REVISION_STALE");
});

test("draft yang sudah ada dilanjutkan dan sumber revisi tidak dapat diganti oleh payload", () => {
  const published = { id: "7" };
  assert.equal(catalogYearConflict({ draft: { id: "8" }, published }).code, "DRAFT_EXISTS");
  assert.equal(
    catalogYearConflict({ draft: { id: "8" }, published, id: "8", revisionOf: "7" }).code,
    "CATALOG_YEAR_PUBLISHED",
  );
  const draft = { id: "8", revision_of_id: "7" };
  assert.equal(catalogYearConflict({ draft, published, id: "8" }), null);
  assert.equal(catalogYearConflict({ draft, id: "8" }).code, "CATALOG_REVISION_STALE");
});

test("urutan tanggal atau pengenal baris bukan perubahan isi katalog", () => {
  const first = { date: "2026-01-01", name: "Tahun Baru", category: "national" };
  const second = { date: "2026-01-02", name: "Cuti bersama", category: "joint_leave" };
  const base = {
    decisionNumber: "SKB 1",
    sourceUrl: "https://contoh.go.id/skb",
    days: [first, second],
  };
  assert.ok(sameCatalogContents(base, { ...base, days: [second, { ...first, id: "9" }] }));
  assert.ok(!sameCatalogContents(base, { ...base, decisionNumber: "SKB 2" }));
  assert.ok(
    !sameCatalogContents(base, { ...base, days: [first, { ...second, category: "national" }] }),
  );
});
