import test from "node:test";
import assert from "node:assert/strict";
import {requiresLateReason,transactionDocumentField,transactionReferenceLabel} from "../lib/inventory/transactionFieldPolicy.mjs";
test("saldo awal tidak memerlukan alasan keterlambatan; operasi sebelumnya wajib",()=>{
  for(const kind of ["opening","receipt","issue","return","stocktake"]) {
    assert.equal(requiresLateReason(kind,"2026-10-12","2026-10-13"),kind!=="opening");
    assert.equal(requiresLateReason(kind,"2026-10-13","2026-10-13"),false);
    assert.equal(requiresLateReason(kind,"","2026-10-13"),false);
  }
  assert.equal(requiresLateReason("reversal","2026-10-12","2026-10-13"),false);
});
test("nomor dokumen hanya untuk penerimaan dan penyaluran; label lama tetap tersedia",()=>{
  assert.match(transactionDocumentField("receipt").label,/penerimaan/);
  assert.match(transactionDocumentField("issue").label,/memo\/permintaan/);
  for(const kind of ["opening","return","stocktake"])assert.equal(transactionDocumentField(kind),null);
  assert.equal(transactionReferenceLabel("opening"),"Nomor referensi tersimpan");
});
