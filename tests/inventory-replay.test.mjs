import test from "node:test";
import assert from "node:assert/strict";
import {scaled,unscaled,replayStock} from "../lib/inventory/replay.mjs";
const row=(id,date,kind,quantity,delta,extra={})=>({id:String(id),lineId:String(id),transactionId:String(id),occurredOn:date,kind,quantity:String(quantity),delta:String(delta),...extra});
test("scaled quantities preserve exact thousandths including large values",()=>{
  assert.equal(unscaled(scaled("999999999999.999")+scaled("0.001")),"1000000000000.000");
  assert.equal(unscaled(scaled("0.1")+scaled("0.2")),"0.300");
  assert.throws(()=>scaled("0.0001"));
});
test("first receipt initializes stock from zero without an opening",()=>{
  const result=replayStock([row(1,"2026-10-09","receipt",3,3)]);
  assert.equal(result.quantity,"3.000");assert.equal(result.initialized,true);
  assert.equal(replayStock([]).initialized,false);
});
test("retro receipt preserves physical stocktake and recalculates reversal effect",()=>{
  const original=[row(1,"2026-10-01","opening",10,10),row(2,"2026-10-05","stocktake",12,2),row(3,"2026-10-06","issue",4,-4),row(4,"2026-10-07","reversal",12,-2,{reversalOfId:"2"})];
  const after=replayStock([...original,row(5,"2026-10-03","receipt",3,3)]);
  assert.equal(after.rows.find((r)=>r.id==="2").effectiveDelta,"-1.000");
  assert.equal(after.rows.find((r)=>r.id==="4").effectiveDelta,"1.000");
  assert.equal(after.quantity,"9.000");
  assert.equal(original[1].delta,"2");
});
test("opening correction precedes retro receipt and preserves original document",()=>{
  const source=[row(1,"2026-10-12","opening",10,10),row(2,"2026-10-09","receipt",3,3)];
  assert.throws(()=>replayStock(source),(e)=>e.code==="BEFORE_OPENING");
  const after=replayStock(source,{occurredOn:"2026-10-09",quantity:7});
  assert.equal(after.quantity,"10.000");assert.equal(after.rows[0].effectiveDate,"2026-10-09");assert.equal(source[0].occurredOn,"2026-10-12");
});
test("negative historical stock reports first exact date and amount",()=>{
  assert.throws(()=>replayStock([row(1,"2026-10-01","receipt",3,3),row(2,"2026-10-02","issue",4,-4),row(3,"2026-10-03","receipt",9,9)]),
    (e)=>e.code==="HISTORICAL_STOCK_NEGATIVE"&&e.facts.date==="2026-10-02"&&e.facts.quantity==="-1.000");
});
