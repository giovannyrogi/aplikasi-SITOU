import { createHash } from "node:crypto";
import { ServiceError } from "@/lib/api/routeHelpers";
import { replayStock, ReplayError } from "./replay.mjs";
import { stockMessage } from "./messages.mjs";

export function calculate(source, correction, facts) {
  try { return replayStock(source, correction); }
  catch (error) {
    if (!(error instanceof ReplayError)) throw error;
    const message = stockMessage(error.code, { ...facts, ...error.facts });
    throw new ServiceError(error.code, message, 409, { lines: message, ...(facts.field ? {[facts.field]:message} : {}) });
  }
}
export async function readReplay(client, org, warehouse, item) {
  const rows = (await client.query(`SELECT m.id::text,m.line_id::text AS "lineId",m.transaction_id AS "transactionId",
    to_char(m.occurred_on,'YYYY-MM-DD') AS "occurredOn",m.delta::text,l.quantity::text,t.kind,t.reversal_of_id AS "reversalOfId"
    FROM inventory_stock_movements m JOIN inventory_transaction_lines l ON l.organization_id=m.organization_id AND l.id=m.line_id
    JOIN inventory_transactions t ON t.organization_id=m.organization_id AND t.id=m.transaction_id
    WHERE m.organization_id=$1 AND m.warehouse_id=$2 AND m.item_id=$3 ORDER BY m.occurred_on,m.id`,[org,warehouse,item])).rows;
  const revision = (await client.query(`SELECT id,original_line_id::text,to_char(occurred_on,'YYYY-MM-DD') AS "occurredOn",quantity::text
    FROM inventory_opening_revisions WHERE organization_id=$1 AND warehouse_id=$2 AND item_id=$3 ORDER BY created_at DESC,id DESC LIMIT 1`,[org,warehouse,item])).rows[0] || null;
  const state = (await client.query(`SELECT version::text,state FROM inventory_stock_calculations WHERE organization_id=$1 AND warehouse_id=$2 AND item_id=$3`,[org,warehouse,item])).rows[0];
  const fingerprint = createHash("sha256").update(JSON.stringify({rows,revision,version:state?.version || "0"})).digest("hex");
  return { rows, revision, version:state?.version || "0", state:state?.state, fingerprint };
}
export function checkFingerprint(state, expected) {
  if (expected && (expected.version !== state.version || expected.fingerprint !== state.fingerprint)) {
    const message = stockMessage("VERSION_CONFLICT", {});
    throw new ServiceError("VERSION_CONFLICT",message,409,{lines:message});
  }
}
export async function persistReplay(client, org, warehouse, item, result) {
  if (result.rows.length) await client.query(`INSERT INTO inventory_stock_projection
    (organization_id,warehouse_id,item_id,line_id,movement_id,effective_on,effective_delta,balance)
    SELECT $1,$2,$3,entry.* FROM unnest($4::bigint[],$5::bigint[],$6::date[],$7::numeric[],$8::numeric[]) entry
    ON CONFLICT(organization_id,line_id) DO UPDATE
    SET effective_on=EXCLUDED.effective_on,effective_delta=EXCLUDED.effective_delta,balance=EXCLUDED.balance`,
    [org,warehouse,item,result.rows.map((r)=>r.lineId),result.rows.map((r)=>r.id),result.rows.map((r)=>r.effectiveDate),result.rows.map((r)=>r.effectiveDelta),result.rows.map((r)=>r.balance)]);
  await client.query(`INSERT INTO inventory_stock_balances(organization_id,warehouse_id,item_id,quantity) VALUES($1,$2,$3,$4)
    ON CONFLICT(organization_id,warehouse_id,item_id) DO UPDATE SET quantity=EXCLUDED.quantity,updated_at=now()`,[org,warehouse,item,result.quantity]);
  await client.query(`INSERT INTO inventory_stock_calculations(organization_id,warehouse_id,item_id) VALUES($1,$2,$3)
    ON CONFLICT(organization_id,warehouse_id,item_id) DO UPDATE SET version=inventory_stock_calculations.version+1,state='active',updated_at=now()`,[org,warehouse,item]);
}
/** Legacy differences require review, never overwrite silently on the next mutation. */
export async function ensureLegacyCompatible(client, org, warehouse, item, state, facts) {
  if (state.state !== "legacy") return;
  const result = calculate(state.rows,state.revision,facts);
  const existing = (await client.query(`SELECT line_id::text,effective_delta::text,balance::text FROM inventory_stock_projection
    WHERE organization_id=$1 AND warehouse_id=$2 AND item_id=$3`,[org,warehouse,item])).rows;
  if (result.rows.some((row)=>{const old=existing.find((r)=>r.line_id===row.lineId);return !old || old.balance!==row.balance || old.effective_delta!==row.effectiveDelta;}))
    throw new ServiceError("REPLAY_REVIEW_REQUIRED","Riwayat stok lama memiliki perbedaan perhitungan. Minta Admin SITOU meninjau laporan perhitungan ulang sebelum mengubah stok ini.",409,{lines:"Riwayat stok menunggu peninjauan Admin SITOU."});
}
