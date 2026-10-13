import {readFile,writeFile} from "node:fs/promises";
import {createHash,randomUUID} from "node:crypto";
import dotenv from "dotenv";
import pg from "pg";
import {replayStock} from "../lib/inventory/replay.mjs";
dotenv.config({path:".env.development",quiet:true});
const args=Object.fromEntries(process.argv.slice(2).map((v)=>{const [k,...parts]=v.replace(/^--/,"").split("=");return [k,parts.join("=")||true];}));
if(typeof args.database!=="string" || typeof args.report!=="string")throw Error("Berikan --database=NAMA dan --report=FILE.json. Default hanya dry-run.");
const database=new pg.Client({database:args.database});
await database.connect();
try {
  await database.query(args.activate?"BEGIN":"BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  const ready=(await database.query("SELECT to_regclass('inventory_opening_revisions') IS NOT NULL AS ready")).rows[0].ready;
  if(args.activate && !ready)throw Error("Jalankan migration 057 terlebih dahulu.");
  if(args.activate)await database.query("SELECT item_id FROM inventory_item_warehouses ORDER BY organization_id,warehouse_id,item_id FOR UPDATE");
  const source=(await database.query(`SELECT m.organization_id::text,m.warehouse_id::text,m.item_id::text,m.id::text,m.line_id::text AS "lineId",m.transaction_id AS "transactionId",
    to_char(m.occurred_on,'YYYY-MM-DD') AS "occurredOn",m.delta::text,l.quantity::text,t.kind,t.reversal_of_id AS "reversalOfId",item.name,warehouse.name AS warehouse
    FROM inventory_stock_movements m JOIN inventory_transaction_lines l ON l.organization_id=m.organization_id AND l.id=m.line_id
    JOIN inventory_transactions t ON t.organization_id=m.organization_id AND t.id=m.transaction_id
    JOIN inventory_items item ON item.organization_id=m.organization_id AND item.id=m.item_id
    JOIN inventory_warehouses warehouse ON warehouse.organization_id=m.organization_id AND warehouse.id=m.warehouse_id
    ORDER BY m.organization_id,m.warehouse_id,m.item_id,m.id`)).rows;
  const revisions=ready?(await database.query(`SELECT DISTINCT ON(organization_id,warehouse_id,item_id) organization_id::text,warehouse_id::text,item_id::text,
    to_char(occurred_on,'YYYY-MM-DD') AS "occurredOn",quantity::text,id FROM inventory_opening_revisions ORDER BY organization_id,warehouse_id,item_id,created_at DESC,id DESC`)).rows:[];
  const balances=(await database.query("SELECT organization_id::text,warehouse_id::text,item_id::text,quantity::text FROM inventory_stock_balances ORDER BY organization_id,warehouse_id,item_id")).rows;
  const projections=ready?(await database.query(`SELECT organization_id::text,line_id::text,to_char(effective_on,'YYYY-MM-DD') AS effective_on,effective_delta::text,balance::text FROM inventory_stock_projection ORDER BY organization_id,line_id`)).rows:[];
  const fingerprint=createHash("sha256").update(JSON.stringify({source,revisions,balances,projections})).digest("hex");
  const groups=new Map();for(const row of source){const key=[row.organization_id,row.warehouse_id,row.item_id].join(":");if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);}
  const results=[];
  for(const [key,rows] of groups) {
    const first=rows[0],revision=revisions.find((r)=>r.organization_id===first.organization_id&&r.warehouse_id===first.warehouse_id&&r.item_id===first.item_id);
    const old=balances.find((r)=>r.organization_id===first.organization_id&&r.warehouse_id===first.warehouse_id&&r.item_id===first.item_id)?.quantity||"0.000";
    try {const result=replayStock(rows,revision);results.push({key,organizationId:first.organization_id,warehouseId:first.warehouse_id,itemId:first.item_id,item:first.name,warehouse:first.warehouse,before:old,after:result.quantity,
      changes:result.rows.filter((r)=>{const old=projections.find((p)=>p.organization_id===first.organization_id&&p.line_id===r.lineId);return old?old.effective_delta!==r.effectiveDelta||old.effective_on!==r.effectiveDate||old.balance!==r.balance:r.effectiveDelta!==r.delta||r.effectiveDate!==r.occurredOn;}).map((r)=>({lineId:r.lineId,originalDate:r.occurredOn,effectiveDate:r.effectiveDate,originalDelta:r.delta,effectiveDelta:r.effectiveDelta})),result});}
    catch(error){results.push({key,error:error.code||error.message,facts:error.facts});}
  }
  if(args.activate) {
    const approved=JSON.parse(await readFile(args.report,"utf8"));
    if(!approved.approved || approved.database!==args.database || approved.fingerprint!==fingerprint)throw Error("Laporan belum disetujui atau sumber telah berubah. Jalankan dry-run dan tinjau kembali.");
    if(results.some((r)=>r.error))throw Error("Ada riwayat invalid. Aktivasi dibatalkan seluruhnya.");
    const actor=(await database.query(`SELECT u.id FROM users u JOIN user_organization_roles a ON a.user_id=u.id JOIN roles r ON r.id=a.role_id WHERE u.id=$1 AND u.is_active AND r.code='superadmin' AND a.active_from<=now() AND (a.active_until IS NULL OR a.active_until>now())`,[args.actor])).rows[0];
    if(!actor)throw Error("Berikan --actor=ID Superadmin aktif.");
    for(const entry of results) {
      for(const row of entry.result.rows)await database.query(`INSERT INTO inventory_stock_projection(organization_id,warehouse_id,item_id,line_id,movement_id,effective_on,effective_delta,balance)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(organization_id,line_id) DO UPDATE SET effective_on=EXCLUDED.effective_on,effective_delta=EXCLUDED.effective_delta,balance=EXCLUDED.balance`,[entry.organizationId,entry.warehouseId,entry.itemId,row.lineId,row.id,row.effectiveDate,row.effectiveDelta,row.balance]);
      await database.query("UPDATE inventory_stock_balances SET quantity=$4,updated_at=now() WHERE organization_id=$1 AND warehouse_id=$2 AND item_id=$3",[entry.organizationId,entry.warehouseId,entry.itemId,entry.after]);
      await database.query(`INSERT INTO inventory_stock_calculations(organization_id,warehouse_id,item_id) VALUES($1,$2,$3) ON CONFLICT(organization_id,warehouse_id,item_id) DO UPDATE SET state='active',version=inventory_stock_calculations.version+1,updated_at=now()`,[entry.organizationId,entry.warehouseId,entry.itemId]);
      await database.query("INSERT INTO audit_logs(organization_id,actor_user_id,action,entity_type,entity_id,before_data,after_data,request_id) VALUES($1,$2,'inventory.replay.activate','inventory_stock',$3,$4::jsonb,$5::jsonb,$6)",[entry.organizationId,actor.id,entry.key,JSON.stringify({quantity:entry.before}),JSON.stringify({quantity:entry.after,changes:entry.changes,fingerprint}),randomUUID()]);
    }
    await database.query("COMMIT");console.log(`Aktivasi terkontrol selesai: ${results.length} pasangan barang–gudang.`);
  }else {
    await database.query("ROLLBACK");
    await writeFile(args.report,JSON.stringify({database:args.database,fingerprint,approved:false,generatedAt:new Date().toISOString(),pairs:results.map(({result,...row})=>{void result;return row;})},null,2));
    console.log(`Dry-run: ${results.length} pasangan, ${results.filter((r)=>r.before!==r.after||r.changes?.length).length} memiliki selisih, ${results.filter((r)=>r.error).length} invalid. Saldo tidak diubah. Laporan: ${args.report}`);
  }
}catch(error){await database.query("ROLLBACK").catch(()=>{});throw error;}finally{await database.end();}
