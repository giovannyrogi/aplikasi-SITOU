import test from "node:test";
import assert from "node:assert/strict";
import { numberedColumns, rowNumberOffset } from "../app/components/data-display/rowNumbers.mjs";

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
