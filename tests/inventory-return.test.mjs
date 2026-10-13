import test from "node:test";
import assert from "node:assert/strict";
import {buildReturnLines,transactionPayload} from "../lib/inventory/returnPolicy.mjs";
test("jumlah awal memakai sisa yang bisa dikembalikan dan mempertahankan perubahan draft",()=>{
  const source=[{itemId:"1",canReturn:true,remainingQuantity:"2.000"},{itemId:"2",canReturn:true,remainingQuantity:"1.500"},{itemId:"3",canReturn:false,remainingQuantity:"0.000"}];
  assert.deepEqual(buildReturnLines(source),[{itemId:1,quantity:2},{itemId:2,quantity:1.5},{itemId:3,quantity:0}]);
  assert.deepEqual(buildReturnLines(source,[{itemId:1,quantity:0},{itemId:2,quantity:1},{itemId:99,quantity:5}]),[{itemId:1,quantity:0},{itemId:2,quantity:1},{itemId:3,quantity:0}]);
});
test("draft mempertahankan semua baris, finalisasi hanya membawa jumlah positif",()=>{
  const input={kind:"return",lines:[{itemId:1,quantity:2},{itemId:2,quantity:0},{itemId:3,quantity:null}]};
  assert.deepEqual(transactionPayload(input).lines,[{itemId:1,quantity:2}]);
  assert.equal(input.lines.length,3);
  const receipt={kind:"receipt",lines:[{itemId:1,quantity:1}]};
  assert.equal(transactionPayload(receipt),receipt);
});
