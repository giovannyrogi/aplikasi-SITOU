import test from "node:test";
import assert from "node:assert/strict";
import { sourceTransactionLabel } from "../lib/inventory/sourceTransactionLabel.mjs";

test("label pengembalian tanpa nomor referensi tidak menampilkan UUID",()=>{
  const id="6435ec3a-1234-4567-8900-123456789012";
  const label=sourceTransactionLabel({id,warehouse_name:"Gudang Pusat",lines:[{name:"Kertas HVS",quantity:"3.000",unit:"Rim"}]},"12 Okt 2026");
  assert.equal(label,"12 Okt 2026 · Gudang Pusat · Kertas HVS · 3 Rim");
  assert.ok(!label.includes("6435ec3a"));
});
test("nomor dokumen dan jumlah barang lain tetap membantu mengenali transaksi",()=>{
  const label=sourceTransactionLabel({reference_no:"BA-001",warehouse_name:"Gudang Pusat",lines:[{name:"Sabun",quantity:"0.500",unit:"Liter"},{name:"Tisu",quantity:1,unit:"Bungkus"}]},"12 Okt 2026");
  assert.match(label,/BA-001/);
  assert.match(label,/0,5 Liter/);
  assert.match(label,/\+1 barang lainnya/);
});
