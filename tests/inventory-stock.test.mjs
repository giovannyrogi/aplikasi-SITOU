import test from "node:test";
import assert from "node:assert/strict";
import { stockCondition } from "../lib/inventory/stockPolicy.mjs";
import { stockFiltersSchema, stockHistorySchema } from "../lib/inventory/stockSchemas.js";

test("stok belum dicatat berbeda dari saldo awal nol dan batas minimum",()=>{
  assert.equal(stockCondition(false,0,5),"unrecorded");
  assert.equal(stockCondition(true,0,0),"empty");
  assert.equal(stockCondition(true,"0.500","1.000"),"low");
  assert.equal(stockCondition(true,5,5),"sufficient");
});
test("filter stok dan kartu stok memvalidasi cakupan, pagination, serta tanggal",()=>{
  assert.equal(stockFiltersSchema.parse({organizationId:"1"}).pageSize,20);
  for(const input of [{warehouseId:0},{pageSize:11},{condition:"unknown"}])
    assert.equal(stockFiltersSchema.safeParse({organizationId:1,...input}).success,false);
  assert.equal(stockHistorySchema.safeParse({organizationId:1,warehouseId:1,itemId:1,from:"2026-10-12",to:"2026-10-01"}).success,false);
});
