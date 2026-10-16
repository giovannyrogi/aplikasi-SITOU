import { actorIdentitySql } from "../identity/actorPresentation.mjs";
const revisionIdentity=actorIdentitySql("account","revision.organization_id","revision_actor");
import { randomUUID } from "node:crypto";
import { withTransaction } from "@/lib/dbTransaction";
import { ServiceError } from "@/lib/api/routeHelpers";
import { writeAudit } from "@/lib/audit";
import { requireInventoryAccess } from "./service";
import { scaled } from "./replay.mjs";
import { readReplay, calculate, checkFingerprint, persistReplay, ensureLegacyCompatible } from "./replayRepository";

async function context(client,input,actor,permission="inventory.transactions.read") {
  await requireInventoryAccess(actor,input.organizationId,permission,input.warehouseId,client);
  if(permission==="inventory.openings.correct") await requireInventoryAccess(actor,input.organizationId,"inventory.transactions.create",input.warehouseId,client);
  const row=(await client.query(`SELECT item.name,warehouse.name AS warehouse,unit.name AS unit,unit.allows_fractional,
    link.is_active AND item.is_active AND warehouse.is_active AS active
    FROM inventory_item_warehouses link JOIN inventory_items item ON item.organization_id=link.organization_id AND item.id=link.item_id
    JOIN inventory_units unit ON unit.organization_id=item.organization_id AND unit.id=item.unit_id
    JOIN inventory_warehouses warehouse ON warehouse.organization_id=link.organization_id AND warehouse.id=link.warehouse_id
    WHERE link.organization_id=$1 AND link.warehouse_id=$2 AND link.item_id=$3 FOR UPDATE OF link`,[input.organizationId,input.warehouseId,input.itemId])).rows[0];
  if(!row)throw new ServiceError("ITEM_UNAVAILABLE","Barang tidak terdaftar di gudang ini.",404);
  if(permission==="inventory.openings.correct" && !row.active)throw new ServiceError("ITEM_INACTIVE","Aktifkan barang dan gudang sebelum mengoreksi stok awal.",409);
  const state=await readReplay(client,input.organizationId,input.warehouseId,input.itemId);
  const opening=state.rows.find((entry)=>entry.kind==="opening");
  if(!opening)throw new ServiceError("MANUAL_OPENING_REQUIRED","Barang ini tidak memiliki stok awal manual yang dapat dikoreksi.",409);
  return {state,opening,facts:{item:row.name,warehouse:row.warehouse,unit:row.unit},allowsFractional:row.allows_fractional};
}
export async function readOpening(input,actor) {
  return withTransaction(async(client)=>{
    const {state,opening,facts,allowsFractional}=await context(client,input,actor);
    const revisions=(await client.query(`SELECT revision.id,revision.operation_id AS "operationId",to_char(revision.occurred_on,'YYYY-MM-DD') AS "occurredOn",revision.quantity::text,revision.reason,revision.created_at,
      ${revisionIdentity.name} AS actor FROM inventory_opening_revisions revision JOIN users account ON account.id=revision.created_by_user_id ${revisionIdentity.joins}
      WHERE revision.organization_id=$1 AND revision.warehouse_id=$2 AND revision.item_id=$3 ORDER BY revision.created_at DESC,revision.id DESC`,[input.organizationId,input.warehouseId,input.itemId])).rows;
    const result=calculate(state.rows,state.revision,facts);
    return {...facts,allowsFractional,original:{occurredOn:opening.occurredOn,quantity:opening.quantity},
      effective:{occurredOn:state.revision?.occurredOn||opening.occurredOn,quantity:state.revision?.quantity||opening.quantity},
      current:result.quantity,version:state.version,fingerprint:state.fingerprint,revisions,
      history:result.rows.map(({kind,effectiveDate,quantity,effectiveDelta,balance})=>({kind,occurredOn:effectiveDate,quantity,effectiveDelta,balance}))};
  });
}
export async function prepareOpeningCorrections(client,input,actor) {
  const corrections=input.openingCorrections || [];
  if(corrections.length && input.kind!=="receipt")throw new ServiceError("CORRECTION_KIND_INVALID","Koreksi dari draft hanya dapat digabung dengan Barang Masuk.",400,{openingCorrections:"Gunakan koreksi mandiri untuk jenis transaksi ini."});
  if(new Set(corrections.map((c)=>String(c.itemId))).size!==corrections.length)throw new ServiceError("DUPLICATE_CORRECTION","Stok awal barang yang sama cukup dikoreksi sekali.",400);
  for(const correction of corrections) {
    if(input.lines && !input.lines.some((line)=>String(line.itemId)===String(correction.itemId)))throw new ServiceError("CORRECTION_ITEM_INVALID","Barang yang dikoreksi harus termasuk dalam penerimaan ini.",400);
    const ctx=await context(client,{...input,itemId:correction.itemId},actor,"inventory.openings.correct");
    await ensureLegacyCompatible(client,input.organizationId,input.warehouseId,correction.itemId,ctx.state,ctx.facts);
    checkFingerprint(ctx.state,correction);
    if(!ctx.allowsFractional && scaled(correction.quantity)%1000n!==0n)throw new ServiceError("FRACTION_NOT_ALLOWED","Jumlah stok awal harus bilangan bulat untuk satuan barang ini.",400,{"openingCorrections.quantity":"Masukkan bilangan bulat."});
    const today=(await client.query("SELECT to_char((now() AT TIME ZONE timezone)::date,'YYYY-MM-DD') AS today FROM organizations WHERE id=$1",[input.organizationId])).rows[0].today;
    if(correction.occurredOn>today)throw new ServiceError("OPENING_DATE_FUTURE","Tanggal stok awal tidak boleh melewati hari ini.",400,{"openingCorrections.occurredOn":"Pilih hari ini atau tanggal sebelumnya."});
    const earliest=[...ctx.state.rows.filter((r)=>r.kind!=="opening").map((r)=>r.occurredOn),...(input.occurredOn?[input.occurredOn]:[])].sort()[0];
    if(earliest && correction.occurredOn>earliest)throw new ServiceError("OPENING_AFTER_OPERATION",`Tanggal stok awal harus pada atau sebelum transaksi pertama, yaitu ${earliest}.`,409,{"openingCorrections.occurredOn":`Pilih tanggal paling lambat ${earliest}.`});
    if(!input.lines)calculate(ctx.state.rows,correction,ctx.facts);
  }
  return corrections;
}
export async function saveOpeningCorrections(client,input,actor,requestId) {
  for(const correction of input.openingCorrections || []) {
    const ctx=await context(client,{...input,itemId:correction.itemId},actor,"inventory.openings.correct");
    checkFingerprint(ctx.state,correction);
    const before=calculate(ctx.state.rows,ctx.state.revision,ctx.facts);
    const receipt=input.lines?.find((line)=>String(line.itemId)===String(correction.itemId));
    const after=calculate(receipt?[...ctx.state.rows,{id:String(ctx.state.rows.reduce((max,row)=>BigInt(row.id)>max?BigInt(row.id):max,0n)+1n),lineId:"pending",transactionId:input.transactionId,kind:"receipt",quantity:String(receipt.quantity),delta:String(receipt.quantity),occurredOn:input.occurredOn}]:ctx.state.rows,correction,ctx.facts);
    const id=randomUUID();
    await client.query(`INSERT INTO inventory_opening_revisions(id,organization_id,warehouse_id,item_id,original_line_id,previous_revision_id,occurred_on,quantity,reason,created_by_user_id,operation_id)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,[id,input.organizationId,input.warehouseId,correction.itemId,ctx.opening.lineId,ctx.state.revision?.id||null,correction.occurredOn,correction.quantity,correction.reason,actor.id,input.transactionId||input.operationId]);
    await writeAudit(client,{organizationId:input.organizationId,actorUserId:actor.id,action:"inventory.opening.correct",entityType:"inventory_opening_revision",entityId:id,
      beforeData:{opening:ctx.state.revision||ctx.opening,balance:before.quantity},afterData:{...correction,balance:after.quantity,checkpoints:after.rows.filter((r)=>r.kind==="stocktake").map((r)=>({id:r.transactionId,originalDelta:r.delta,effectiveDelta:r.effectiveDelta}))},requestId});
  }
}
export async function previewOpening(input,actor) {
  return withTransaction(async(client)=>{
    const ctx=await context(client,input,actor,"inventory.openings.correct");
    const correction={itemId:input.itemId,...input.correction};
    await prepareOpeningCorrections(client,{...input,kind:"receipt",openingCorrections:[correction]},actor);
    const before=calculate(ctx.state.rows,ctx.state.revision,ctx.facts),after=calculate(ctx.state.rows,correction,ctx.facts);
    return {...ctx.facts,before:before.quantity,after:after.quantity,version:ctx.state.version,fingerprint:ctx.state.fingerprint,
      history:after.rows.map((row)=>({kind:row.kind,occurredOn:row.effectiveDate,quantity:row.quantity,originalDelta:row.delta,effectiveDelta:row.effectiveDelta,balance:row.balance}))};
  });
}
export async function correctOpening(input,actor,requestId) {
  return withTransaction(async(client)=>{
    const ctx=await context(client,input,actor,"inventory.openings.correct");
    const previous=(await client.query("SELECT id,occurred_on::text,quantity::text,reason,created_by_user_id::text FROM inventory_opening_revisions WHERE organization_id=$1 AND warehouse_id=$2 AND item_id=$3 AND operation_id=$4",[input.organizationId,input.warehouseId,input.itemId,input.operationId])).rows[0];
    if(previous) {
      if(previous.occurred_on!==input.correction.occurredOn || scaled(previous.quantity)!==scaled(input.correction.quantity)||previous.reason!==input.correction.reason||previous.created_by_user_id!==String(actor.id))throw new ServiceError("OPERATION_ID_USED","Permintaan sudah digunakan untuk koreksi yang berbeda.",409);
      return {id:previous.id,alreadySaved:true};
    }
    const correction={itemId:input.itemId,...input.correction};
    const payload={...input,kind:"receipt",openingCorrections:[correction]};
    await prepareOpeningCorrections(client,payload,actor);
    await saveOpeningCorrections(client,payload,actor,requestId);
    await persistReplay(client,input.organizationId,input.warehouseId,input.itemId,calculate(ctx.state.rows,correction,ctx.facts));
    return {operationId:input.operationId};
  });
}
