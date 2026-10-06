import test from "node:test";
import assert from "node:assert/strict";
import {
  numberedColumns,
  rowNumberOffset,
  paginationTotalLabel,
} from "../app/components/data-display/rowNumbers.mjs";

test("total pagination menampilkan seluruh hasil termasuk nol dan tidak mengarang total", () => {
  assert.equal(paginationTotalLabel(1170), "Total: 1.170 data");
  assert.equal(paginationTotalLabel("57"), "Total: 57 data");
  assert.equal(paginationTotalLabel(0), "Total: 0 data");
  for (const total of [null, undefined, -1, 2.5, "invalid"])
    assert.equal(paginationTotalLabel(total), "Total data belum tersedia");
});

test("nomor tabel berlanjut untuk pagination biasa", () => {
  assert.equal(rowNumberOffset({ page: 3, pageSize: 20 }), 40);
  const [number] = numberedColumns([], 40);
  assert.equal(number.render(null, null, 0), 41);
  assert.equal(number.render(null, null, 19), 60);
});

test("offset cursor dari server diprioritaskan agar nomor laporan tidak kembali ke satu", () => {
  assert.equal(rowNumberOffset({ page: 1, pageSize: 20 }, 60), 60);
  assert.equal(rowNumberOffset(undefined), 0);
});
