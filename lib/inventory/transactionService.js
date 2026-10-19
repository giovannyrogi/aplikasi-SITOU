import { recipientPositionJoin } from "./recipientPresentation.mjs";
import { actorIdentitySql } from "../identity/actorPresentation.mjs";
const actorIdentity = actorIdentitySql("account", "tx.organization_id");
const cancellationIdentity = actorIdentitySql("cancelled_by", "tx.organization_id", "cancelled_by");
import { randomUUID } from "node:crypto";
import pool from "@/lib/dbConfig";
import { withTransaction } from "@/lib/dbTransaction";
import { ServiceError } from "@/lib/api/routeHelpers";
import { writeAudit } from "@/lib/audit";
import { requireInventoryAccess } from "./service";
import { requiresLateReason } from "./transactionFieldPolicy.mjs";
import { scaled, unscaled } from "./replay.mjs";
import { readReplay, calculate, persistReplay, checkFingerprint, ensureLegacyCompatible } from "./replayRepository";
import { stockMessage, formatStockQuantity } from "./messages.mjs";
import { prepareOpeningCorrections, saveOpeningCorrections } from "./openingService";
import { prepareEmployeeFileUpload, finalizePreparedEmployeeFile, insertPreparedEmployeeFile, discardPreparedEmployeeFile, stageStoredFilesForDeletion } from "@/lib/files/storage";

const kinds = { opening: "Stok awal", receipt: "Barang masuk", issue: "Barang keluar", return: "Pengembalian", stocktake: "Stok opname", reversal: "Pembatalan" };
const milli = scaled;
const decimal = unscaled;
const dateOf = (value) => value instanceof Date
  ? `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,"0")}-${String(value.getDate()).padStart(2,"0")}`
  : String(value).slice(0,10);
const fail = (code, message, status = 400, fieldErrors) => { throw new ServiceError(code, message, status, fieldErrors); };

async function todayForOrganization(client, organizationId) {
  const result = await client.query(
    "SELECT to_char((now() AT TIME ZONE timezone)::date,'YYYY-MM-DD') AS today FROM organizations WHERE id=$1 AND is_active",
    [organizationId],
  );
  if (!result.rowCount) fail("ORGANIZATION_UNAVAILABLE", "Organisasi tidak tersedia.", 404);
  return result.rows[0].today;
}

function validateDate(occurredOn, today, lateReason, kind) {
  const days = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${occurredOn}T00:00:00Z`)) / 86400000);
  if (!Number.isInteger(days)) fail("TRANSACTION_DATE_INVALID","Tanggal transaksi tidak valid.",400,{occurredOn:"Pilih tanggal yang valid."});
  if (days < 0) fail("TRANSACTION_DATE_FUTURE",stockMessage("TRANSACTION_DATE_FUTURE",{}),400,{occurredOn:"Pilih hari ini atau tanggal sebelumnya."});
  if (days > 30) fail("TRANSACTION_DATE_TOO_OLD",stockMessage("TRANSACTION_DATE_TOO_OLD",{}),400,{occurredOn:"Pilih tanggal dalam 30 hari terakhir."});
  if (requiresLateReason(kind,occurredOn,today) && (!lateReason || lateReason.trim().length < 10))
    fail("LATE_REASON_REQUIRED", "Jelaskan alasan input terlambat, minimal 10 karakter.", 400, { lateReason: "Alasan wajib diisi untuk tanggal sebelumnya." });
}

async function lockWarehouseAndItems(client, input) {
  const warehouse = await client.query(
    "SELECT id,location_id,name FROM inventory_warehouses WHERE organization_id=$1 AND id=$2 AND is_active FOR SHARE",
    [input.organizationId, input.warehouseId],
  );
  if (!warehouse.rowCount) fail("WAREHOUSE_UNAVAILABLE", "Pilih gudang aktif yang tersedia.", 400, { warehouseId: "Gudang tidak tersedia." });
  const ids = [...new Set(input.lines.map((line) => String(line.itemId)))].sort((a, b) => BigInt(a) < BigInt(b) ? -1 : 1);
  if (ids.length !== input.lines.length) fail("DUPLICATE_ITEM", "Barang yang sama cukup dimasukkan satu kali.", 400, { lines: "Ada barang yang dipilih lebih dari sekali." });
  const links = [];
  for (const itemId of ids) {
    const row = await client.query(
      `SELECT link.item_id::text,item.name,unit.name AS unit_name,unit.allows_fractional,
              COALESCE(balance.quantity,0)::text AS balance
       FROM inventory_item_warehouses link
       JOIN inventory_items item ON item.organization_id=link.organization_id AND item.id=link.item_id AND item.is_active
       JOIN inventory_units unit ON unit.organization_id=item.organization_id AND unit.id=item.unit_id
       LEFT JOIN inventory_stock_balances balance ON balance.organization_id=link.organization_id AND balance.item_id=link.item_id AND balance.warehouse_id=link.warehouse_id
       WHERE link.organization_id=$1 AND link.warehouse_id=$2 AND link.item_id=$3 AND link.is_active
       FOR UPDATE OF link`,
      [input.organizationId, input.warehouseId, itemId],
    );
    if (!row.rowCount) fail("ITEM_UNAVAILABLE", "Ada barang yang tidak aktif atau belum didaftarkan di gudang ini.", 400, { lines: "Pilih barang aktif yang sudah didaftarkan pada gudang." });
    links.push(row.rows[0]);
  }
  return { warehouse: warehouse.rows[0], links };
}

async function checkDestination(client, input) {
  if (input.kind !== "issue") {
    if (input.destinationLocationId || input.destinationUnitId || input.recipientEmployeeId)
      fail("DESTINATION_NOT_ALLOWED", "Tujuan hanya diisi untuk barang keluar.");
    return;
  }
  if (!input.destinationLocationId || !input.destinationUnitId || !input.recipientEmployeeId)
    fail("DESTINATION_REQUIRED", "Pilih lokasi, Divisi & Unit, dan pegawai penerima.", 400, { destinationLocationId: "Tujuan barang keluar wajib lengkap." });
  const destination = await client.query(
    `SELECT 1 FROM organization_unit_locations linked
     JOIN employee_assignments assignment ON assignment.organization_id=linked.organization_id
       AND assignment.location_id=linked.location_id AND assignment.organization_unit_id=linked.organization_unit_id
       AND assignment.employee_id=$4 AND assignment.assignment_type='primary'
       AND assignment.effective_from<=$5::date AND (assignment.effective_until IS NULL OR assignment.effective_until>=$5::date)
     JOIN employees employee ON employee.organization_id=assignment.organization_id AND employee.id=assignment.employee_id
       AND employee.deleted_at IS NULL AND employee.employment_status IN ('active','probation','suspended')
     WHERE linked.organization_id=$1 AND linked.location_id=$2 AND linked.organization_unit_id=$3
       AND linked.active_from<=$5::date AND (linked.active_until IS NULL OR linked.active_until>=$5::date) LIMIT 1`,
    [input.organizationId, input.destinationLocationId, input.destinationUnitId, input.recipientEmployeeId, input.occurredOn],
  );
  if (!destination.rowCount)
    fail("RECIPIENT_INVALID", "Pegawai penerima tidak bertugas pada lokasi dan Divisi & Unit tujuan di tanggal transaksi.", 400, { recipientEmployeeId: "Pilih pegawai yang bertugas di tujuan pada tanggal ini." });
}

async function getSourceLines(client, input) {
  if (input.kind !== "return") {
    if (input.sourceTransactionId) fail("SOURCE_NOT_ALLOWED", "Referensi barang keluar hanya untuk pengembalian.");
    return new Map();
  }
  if (!input.sourceTransactionId) fail("SOURCE_REQUIRED", "Pilih transaksi barang keluar yang dikembalikan.", 400, { sourceTransactionId: "Transaksi asal wajib dipilih." });
  // Lock terpisah memberi query jumlah berikutnya snapshot baru setelah menunggu petugas lain.
  await client.query(`SELECT id FROM inventory_transactions
    WHERE organization_id=$1 AND id=$2 AND warehouse_id=$3 AND kind='issue' AND status='posted' FOR UPDATE`,
    [input.organizationId,input.sourceTransactionId,input.warehouseId]);
  const source = await client.query(
    `SELECT line.id::text AS line_id,line.item_id::text,line.quantity::text,tx.occurred_on,
       COALESCE((SELECT sum(returned.quantity) FROM inventory_transaction_lines returned
         JOIN inventory_transactions ret ON ret.organization_id=returned.organization_id AND ret.id=returned.transaction_id
         WHERE returned.organization_id=line.organization_id AND returned.source_line_id=line.id AND ret.status='posted'
           AND NOT EXISTS (SELECT 1 FROM inventory_transactions reversal WHERE reversal.organization_id=ret.organization_id AND reversal.reversal_of_id=ret.id)),0)::text AS returned
     FROM inventory_transactions tx JOIN inventory_transaction_lines line ON line.organization_id=tx.organization_id AND line.transaction_id=tx.id
     WHERE tx.organization_id=$1 AND tx.id=$2 AND tx.warehouse_id=$3 AND tx.kind='issue' AND tx.status='posted'
       AND NOT EXISTS (SELECT 1 FROM inventory_transactions reversal WHERE reversal.organization_id=tx.organization_id AND reversal.reversal_of_id=tx.id)
     FOR UPDATE OF tx`,
    [input.organizationId, input.sourceTransactionId, input.warehouseId],
  );
  if (!source.rowCount) fail("SOURCE_UNAVAILABLE", "Transaksi penyaluran tidak tersedia atau sudah dibatalkan.", 400, { sourceTransactionId: "Pilih transaksi penyaluran sebelumnya yang masih berlaku." });
  return new Map(source.rows.map((row) => [row.item_id, row]));
}

/** Batas pengembalian berasal dari transaksi resmi dan pengembalian yang masih berlaku. */
export async function returnSourceOptions(organizationId,actor,id,warehouseId){
  return withTransaction(async(client)=>{
    await requireInventoryAccess(actor,organizationId,"inventory.transactions.create",warehouseId,client);
    const source=await getTransaction(organizationId,actor,id,client);
    const originals=await getSourceLines(client,{organizationId,warehouseId,sourceTransactionId:id,kind:"return"});
    const metadata=(await client.query(`SELECT item.id::text,item.code,item.photo_file_id::text,category.name AS category_name,unit.name AS unit_name,unit.allows_fractional,
      COALESCE(balance.quantity,0)::text AS balance,
      (item.is_active AND warehouse.is_active AND COALESCE(link.is_active,false) AND balance.item_id IS NOT NULL) AS can_return
      FROM inventory_items item JOIN inventory_units unit ON unit.organization_id=item.organization_id AND unit.id=item.unit_id
      JOIN inventory_categories category ON category.organization_id=item.organization_id AND category.id=item.category_id
      JOIN inventory_warehouses warehouse ON warehouse.organization_id=item.organization_id AND warehouse.id=$2
      LEFT JOIN inventory_item_warehouses link ON link.organization_id=item.organization_id AND link.item_id=item.id AND link.warehouse_id=$2
      LEFT JOIN inventory_stock_balances balance ON balance.organization_id=item.organization_id AND balance.item_id=item.id AND balance.warehouse_id=$2
      LEFT JOIN inventory_stock_openings opening ON opening.organization_id=item.organization_id AND opening.item_id=item.id AND opening.warehouse_id=$2
      WHERE item.organization_id=$1 AND item.id=ANY($3::bigint[])`,[organizationId,warehouseId,[...originals.keys()]])).rows;
    return {...source,today:await todayForOrganization(client,organizationId),lines:source.lines.map((line)=>{
      const original=originals.get(line.itemId);
      const item=metadata.find((row)=>row.id===line.itemId);
      const difference=milli(original.quantity)-milli(original.returned);
      const remaining=difference>0n?difference:0n;
      return {...line,code:item?.code,category_name:item?.category_name,photo_file_id:item?.photo_file_id,unit_name:item?.unit_name || line.unit,returnedQuantity:original.returned,remainingQuantity:decimal(remaining),allows_fractional:item?.allows_fractional || false,balance:item?.balance || "0",canReturn:!!item?.can_return && remaining>0};
    })};
  });
}

async function validateHistoryAndBalance(client, input, itemId) {
  const state=await readReplay(client,input.organizationId,input.warehouseId,itemId);
  const metadata=(await client.query("SELECT item.name,warehouse.name AS warehouse,unit.name AS unit FROM inventory_items item JOIN inventory_units unit ON unit.organization_id=item.organization_id AND unit.id=item.unit_id JOIN inventory_warehouses warehouse ON warehouse.organization_id=item.organization_id AND warehouse.id=$2 WHERE item.organization_id=$1 AND item.id=$3",[input.organizationId,input.warehouseId,itemId])).rows[0];
  const result=calculate(state.rows,state.revision,{item:metadata.name,warehouse:metadata.warehouse,unit:metadata.unit});
  await persistReplay(client,input.organizationId,input.warehouseId,itemId,result);
  return result.quantity;
}

export async function transactionOptions(organizationId, actor, warehouseId = null, itemSearch = "", includeItemIds = []) {
  const scope = await requireInventoryAccess(actor, organizationId, "inventory.transactions.read", warehouseId);
  const warehouses = (await pool.query(
    `SELECT id::text,name,location_id::text FROM inventory_warehouses
     WHERE organization_id=$1 AND is_active AND ($2::bigint[] IS NULL OR id=ANY($2::bigint[])) ORDER BY name`,
    [organizationId, scope],
  )).rows;
  const items = warehouseId ? (await pool.query(
    `SELECT item.id::text,item.code,item.name,category.name AS category_name,unit.name AS unit_name,unit.allows_fractional,item.photo_file_id::text,
            CASE WHEN balance.item_id IS NOT NULL THEN balance.quantity::text END AS balance,
            to_char(COALESCE(revision.occurred_on,opening.occurred_on),'YYYY-MM-DD') AS opening_date,
            balance.item_id IS NOT NULL AS has_history,
            (opening.item_id IS NULL AND NOT EXISTS(SELECT 1 FROM inventory_stock_movements history WHERE history.organization_id=link.organization_id AND history.warehouse_id=link.warehouse_id AND history.item_id=link.item_id)) AS opening_eligible
     FROM inventory_item_warehouses link JOIN inventory_items item ON item.organization_id=link.organization_id AND item.id=link.item_id
     JOIN inventory_units unit ON unit.organization_id=item.organization_id AND unit.id=item.unit_id
     JOIN inventory_categories category ON category.organization_id=item.organization_id AND category.id=item.category_id
     LEFT JOIN inventory_stock_balances balance ON balance.organization_id=link.organization_id AND balance.warehouse_id=link.warehouse_id AND balance.item_id=link.item_id
     LEFT JOIN inventory_stock_openings opening ON opening.organization_id=link.organization_id AND opening.warehouse_id=link.warehouse_id AND opening.item_id=link.item_id
     LEFT JOIN LATERAL (SELECT occurred_on FROM inventory_opening_revisions WHERE organization_id=link.organization_id AND warehouse_id=link.warehouse_id AND item_id=link.item_id ORDER BY created_at DESC,id DESC LIMIT 1) revision ON true
     WHERE link.organization_id=$1 AND link.warehouse_id=$2 AND link.is_active AND item.is_active
       AND ($3::text='' OR item.name ILIKE $3 OR item.code ILIKE $3 OR item.id=ANY($4::bigint[]))
     ORDER BY CASE WHEN item.id=ANY($4::bigint[]) THEN 0 ELSE 1 END,item.name LIMIT 100`,
    [organizationId, warehouseId, itemSearch ? `%${itemSearch}%` : "", includeItemIds],
  )).rows : [];
  const locations = (await pool.query(
    `SELECT id::text,name FROM locations WHERE organization_id=$1 AND is_active ORDER BY name`, [organizationId],
  )).rows;
  const units = (await pool.query(
    `SELECT linked.location_id::text,unit.id::text,unit.name FROM organization_unit_locations linked
     JOIN organization_units unit ON unit.organization_id=linked.organization_id AND unit.id=linked.organization_unit_id
     WHERE linked.organization_id=$1 AND unit.is_active AND linked.active_from<=current_date
       AND (linked.active_until IS NULL OR linked.active_until>=current_date) ORDER BY unit.name`, [organizationId],
  )).rows;
  let canCreate = true;
  let createScope = [];
  try { createScope=await requireInventoryAccess(actor, organizationId, "inventory.transactions.create",warehouseId); }
  catch { canCreate = false; }
  const eligibleWarehouses=canCreate?(await pool.query(`SELECT link.warehouse_id::text,count(*)::int AS eligible_count FROM inventory_item_warehouses link
    JOIN inventory_items item ON item.organization_id=link.organization_id AND item.id=link.item_id AND item.is_active
    JOIN inventory_warehouses warehouse ON warehouse.organization_id=link.organization_id AND warehouse.id=link.warehouse_id AND warehouse.is_active
    WHERE link.organization_id=$1 AND link.is_active AND ($2::bigint[] IS NULL OR link.warehouse_id=ANY($2::bigint[]))
      AND NOT EXISTS(SELECT 1 FROM inventory_stock_movements m WHERE m.organization_id=link.organization_id AND m.warehouse_id=link.warehouse_id AND m.item_id=link.item_id)
      AND NOT EXISTS(SELECT 1 FROM inventory_stock_openings o WHERE o.organization_id=link.organization_id AND o.warehouse_id=link.warehouse_id AND o.item_id=link.item_id)
    GROUP BY link.warehouse_id`,[organizationId,createScope])).rows:[];
  let canCorrectOpening=false;
  try {await requireInventoryAccess(actor,organizationId,"inventory.openings.correct",warehouseId);canCorrectOpening=canCreate;}catch {}
  return { warehouses, items, locations, units, canCreate,canCorrectOpening,eligibleWarehouses,canInitializeOpening:eligibleWarehouses.length>0, today:await todayForOrganization(pool,organizationId) };
}

export async function transactionRecipients(organizationId, actor, { locationId, unitId, occurredOn, warehouseId }) {
  await requireInventoryAccess(actor, organizationId, "inventory.transactions.read", warehouseId);
  return (await pool.query(
    `SELECT DISTINCT employee.id::text,employee.full_name,employee.employee_no,employee.profile_photo_file_id::text AS recipient_photo_file_id,position.name AS recipient_position_name
     FROM employee_assignments assignment JOIN employees employee ON employee.organization_id=assignment.organization_id AND employee.id=assignment.employee_id
     LEFT JOIN positions position ON position.organization_id=assignment.organization_id AND position.id=assignment.position_id
     WHERE assignment.organization_id=$1 AND assignment.location_id=$2 AND assignment.organization_unit_id=$3
       AND assignment.assignment_type='primary' AND assignment.effective_from<=$4::date
       AND (assignment.effective_until IS NULL OR assignment.effective_until>=$4::date)
       AND employee.deleted_at IS NULL AND employee.employment_status IN ('active','probation','suspended')
     ORDER BY employee.full_name LIMIT 500`,
    [organizationId, locationId, unitId, occurredOn],
  )).rows;
}

export async function listTransactions(organizationId, actor, filters) {
  const scope = await requireInventoryAccess(actor, organizationId, "inventory.transactions.read", filters.warehouseId || null);
  const pageSize = filters.pageSize || 20;
  const params = [organizationId, scope, filters.warehouseId || null, filters.kind || "all", filters.from || null, filters.to || null, filters.search ? `%${filters.search}%` : "", filters.status || "all", filters.cursorDate || null, filters.cursorId || null];
  const filterSql = `tx.organization_id=$1 AND ($2::bigint[] IS NULL OR tx.warehouse_id=ANY($2::bigint[]))
       AND ($3::bigint IS NULL OR tx.warehouse_id=$3)
       AND ($4::text='all' OR tx.kind=$4)
       AND tx.status='posted' AND tx.kind<>'reversal'
       AND ($8::text='all' OR ($8='cancelled')=EXISTS(SELECT 1 FROM inventory_transactions reversal
         WHERE reversal.organization_id=tx.organization_id AND reversal.reversal_of_id=tx.id))
       AND ($5::date IS NULL OR tx.occurred_on>=$5)
       AND ($6::date IS NULL OR tx.occurred_on<=$6)
       AND ($7::text='' OR tx.reference_no ILIKE $7 OR warehouse.name ILIKE $7 OR account.username ILIKE $7 OR ${actorIdentity.name} ILIKE $7 OR EXISTS(
         SELECT 1 FROM inventory_transaction_lines search_line JOIN inventory_items search_item
           ON search_item.organization_id=search_line.organization_id AND search_item.id=search_line.item_id
         WHERE search_line.organization_id=tx.organization_id AND search_line.transaction_id=tx.id AND search_item.name ILIKE $7))`;
  const [rows, totalRows] = await Promise.all([pool.query(
    `SELECT tx.id,tx.kind,tx.status,to_char(tx.occurred_on,'YYYY-MM-DD') AS occurred_on,tx.recorded_at,tx.reference_no,tx.warehouse_id::text,
       warehouse.name AS warehouse_name,${actorIdentity.name} AS actor_name,${actorIdentity.photo} AS actor_photo_file_id,${actorIdentity.position} AS actor_position_name,tx.created_at,tx.updated_at,tx.draft_step,
       COALESCE(cancellation.recorded_at,tx.recorded_at) AS sort_at,
       COALESCE(jsonb_agg(jsonb_build_object('itemId',item.id::text,'name',item.name,'quantity',line.quantity::text,'delta',line.delta::text,'unit',unit.name)
         ORDER BY line.id) FILTER(WHERE line.id IS NOT NULL),'[]'::jsonb) AS lines,
       EXISTS(SELECT 1 FROM inventory_transactions reversal WHERE reversal.organization_id=tx.organization_id AND reversal.reversal_of_id=tx.id) AS cancelled
     FROM inventory_transactions tx LEFT JOIN inventory_warehouses warehouse ON warehouse.organization_id=tx.organization_id AND warehouse.id=tx.warehouse_id
     JOIN users account ON account.id=tx.created_by_user_id ${actorIdentity.joins}
     LEFT JOIN inventory_transaction_lines line ON line.organization_id=tx.organization_id AND line.transaction_id=tx.id
     LEFT JOIN inventory_items item ON item.organization_id=line.organization_id AND item.id=line.item_id
     LEFT JOIN inventory_units unit ON unit.organization_id=item.organization_id AND unit.id=item.unit_id
     LEFT JOIN LATERAL (SELECT reversal.recorded_at FROM inventory_transactions reversal
       WHERE reversal.organization_id=tx.organization_id AND reversal.reversal_of_id=tx.id
       ORDER BY reversal.recorded_at DESC,reversal.id DESC LIMIT 1) cancellation ON true
     WHERE ${filterSql}
       AND ($9::timestamptz IS NULL OR COALESCE(cancellation.recorded_at,tx.recorded_at)<$9
         OR (COALESCE(cancellation.recorded_at,tx.recorded_at)=$9 AND tx.id<$10::uuid))
     GROUP BY tx.id,warehouse.name,account.username,cancellation.recorded_at,${actorIdentity.group}
     ORDER BY sort_at DESC,tx.id DESC LIMIT $11`,
    [...params,pageSize+1],
  ), pool.query(
    `SELECT COUNT(*)::integer AS total FROM inventory_transactions tx
     LEFT JOIN inventory_warehouses warehouse ON warehouse.organization_id=tx.organization_id AND warehouse.id=tx.warehouse_id
     JOIN users account ON account.id=tx.created_by_user_id ${actorIdentity.joins}
     WHERE ${filterSql}`,
    params.slice(0,8),
  )]);
  const data = rows.rows.slice(0, pageSize);
  const last = data.at(-1);
  return { data, total: totalRows.rows[0].total, nextCursor: rows.rows.length > pageSize && last ? Buffer.from(JSON.stringify([last.sort_at,last.id])).toString("base64url") : null, kinds };
}

export async function getLatestTransactionDraft(organizationId, actor) {
  const scope = await requireInventoryAccess(actor, organizationId, "inventory.transactions.create");
  const expired=(await pool.query(`SELECT id FROM inventory_transactions WHERE organization_id=$1 AND created_by_user_id=$2
    AND status='draft' AND draft_discarded_at IS NULL AND draft_expires_at<=now() ORDER BY draft_expires_at LIMIT 20`,[organizationId,actor.id])).rows;
  for(const row of expired) await discardTransactionDraft(organizationId,row.id,actor,null,{expired:true});
  const rows = (await pool.query(`SELECT tx.id,tx.kind,tx.draft_step,tx.updated_at,tx.draft_expires_at,
      to_char(tx.occurred_on,'YYYY-MM-DD') AS occurred_on,warehouse.name AS warehouse_name,
      CASE WHEN jsonb_typeof(tx.draft_payload->'lines')='array' THEN jsonb_array_length(tx.draft_payload->'lines') ELSE 0 END AS item_count
    FROM inventory_transactions tx LEFT JOIN inventory_warehouses warehouse
      ON warehouse.organization_id=tx.organization_id AND warehouse.id=tx.warehouse_id
    WHERE tx.organization_id=$1 AND tx.created_by_user_id=$2 AND tx.status='draft'
      AND tx.draft_discarded_at IS NULL AND tx.draft_expires_at>now()
      AND ($3::bigint[] IS NULL OR tx.warehouse_id IS NULL OR tx.warehouse_id=ANY($3::bigint[]))
    ORDER BY tx.updated_at DESC,tx.id DESC LIMIT 1`,[organizationId,actor.id,scope])).rows;
  return rows[0] || null;
}

export async function getTransaction(organizationId, actor, id, database = pool) {
  const row = (await database.query(
    `SELECT tx.id,tx.kind,tx.status,tx.warehouse_id::text,warehouse.name AS warehouse_name,to_char(tx.occurred_on,'YYYY-MM-DD') AS occurred_on,
       tx.recorded_at,tx.updated_at,tx.reference_no,tx.notes,tx.late_reason,tx.destination_location_id::text,
       tx.destination_unit_id::text,tx.recipient_employee_id::text,tx.source_transaction_id,tx.reversal_of_id,
       destination.name AS destination_location_name,destination_unit.name AS destination_unit_name,recipient.full_name AS recipient_name,recipient.profile_photo_file_id::text AS recipient_photo_file_id,recipient_assignment.position_name AS recipient_position_name,
       tx.draft_payload,tx.version,tx.draft_step,tx.draft_expires_at,tx.draft_discarded_at,tx.created_by_user_id::text,${actorIdentity.name} AS actor_name,${actorIdentity.photo} AS actor_photo_file_id,${actorIdentity.position} AS actor_position_name,
       cancellation.id AS cancellation_id,cancellation.notes AS cancellation_reason,cancellation.recorded_at AS cancelled_at,
       ${cancellationIdentity.name} AS cancelled_by_name,${cancellationIdentity.photo} AS cancelled_by_photo_file_id,${cancellationIdentity.position} AS cancelled_by_position_name,
       EXISTS(SELECT 1 FROM inventory_transactions reversal WHERE reversal.organization_id=tx.organization_id AND reversal.reversal_of_id=tx.id) AS cancelled,
       COALESCE((SELECT jsonb_agg(jsonb_build_object('id',attachment.file_id::text,'purpose',attachment.purpose,'name',file.original_name,'mimeType',file.mime_type,'sizeBytes',file.size_bytes) ORDER BY attachment.file_id)
         FROM inventory_transaction_files attachment JOIN stored_files file ON file.organization_id=attachment.organization_id AND file.id=attachment.file_id
         WHERE attachment.organization_id=tx.organization_id AND attachment.transaction_id=tx.id),'[]'::jsonb) AS files,
       COALESCE((SELECT jsonb_agg(jsonb_build_object('id',line.id::text,'itemId',line.item_id::text,'name',item.name,'photo_file_id',item.photo_file_id::text,'quantity',line.quantity::text,'delta',line.delta::text,'unit',unit.name) ORDER BY line.id)
         FROM inventory_transaction_lines line JOIN inventory_items item ON item.organization_id=line.organization_id AND item.id=line.item_id
         JOIN inventory_units unit ON unit.organization_id=item.organization_id AND unit.id=item.unit_id
         WHERE line.organization_id=tx.organization_id AND line.transaction_id=tx.id),'[]'::jsonb) AS lines
     FROM inventory_transactions tx LEFT JOIN inventory_warehouses warehouse ON warehouse.organization_id=tx.organization_id AND warehouse.id=tx.warehouse_id
     LEFT JOIN locations destination ON destination.organization_id=tx.organization_id AND destination.id=tx.destination_location_id
     LEFT JOIN organization_units destination_unit ON destination_unit.organization_id=tx.organization_id AND destination_unit.id=tx.destination_unit_id
     LEFT JOIN employees recipient ON recipient.organization_id=tx.organization_id AND recipient.id=tx.recipient_employee_id ${recipientPositionJoin}
     JOIN users account ON account.id=tx.created_by_user_id ${actorIdentity.joins}
     LEFT JOIN LATERAL (SELECT reversal.id,reversal.notes,reversal.recorded_at,reversal.created_by_user_id
       FROM inventory_transactions reversal WHERE reversal.organization_id=tx.organization_id AND reversal.reversal_of_id=tx.id
       ORDER BY reversal.recorded_at DESC,reversal.id DESC LIMIT 1) cancellation ON true
     LEFT JOIN users cancelled_by ON cancelled_by.id=cancellation.created_by_user_id ${cancellationIdentity.joins}
     WHERE tx.organization_id=$1 AND tx.id=$2`, [organizationId,id],
  )).rows[0];
  if (!row) fail("NOT_FOUND", "Transaksi tidak ditemukan.", 404);
  await requireInventoryAccess(actor, organizationId, "inventory.transactions.read", row.warehouse_id, database);
  if (row.status === "draft" && (row.created_by_user_id !== String(actor.id) || row.draft_discarded_at || new Date(row.draft_expires_at)<=new Date())) fail("NOT_FOUND", "Draft tidak tersedia atau sudah kedaluwarsa.", 404);
  return row;
}

export async function saveDraft(input, actor, requestId) {
  return withTransaction(async (client) => {
    await requireInventoryAccess(actor, input.organizationId, "inventory.transactions.create", input.warehouseId || null, client);
    const old = (await client.query("SELECT id,status,kind,version,created_by_user_id,warehouse_id,draft_discarded_at,draft_expires_at FROM inventory_transactions WHERE organization_id=$1 AND id=$2 FOR UPDATE", [input.organizationId,input.transactionId])).rows[0];
    if (old && (old.status !== "draft" || String(old.created_by_user_id) !== String(actor.id) || old.draft_discarded_at || new Date(old.draft_expires_at)<=new Date())) fail("DRAFT_UNAVAILABLE", "Draft tidak dapat diubah atau telah kedaluwarsa.", 409);
    if (old && old.version !== input.version) fail("VERSION_CONFLICT", "Draft telah berubah. Muat ulang sebelum menyimpan.", 409);
    const payload = { ...input, version: undefined };
    if (old && old.kind !== (input.kind || "receipt")) {
      const obsolete = (await client.query(`SELECT file.id::text,file.object_key FROM inventory_transaction_files linked
        JOIN stored_files file ON file.organization_id=linked.organization_id AND file.id=linked.file_id
        WHERE linked.organization_id=$1 AND linked.transaction_id=$2 AND file.lifecycle_status='draft' FOR UPDATE OF file`,[input.organizationId,input.transactionId])).rows;
      await client.query("DELETE FROM inventory_transaction_files WHERE organization_id=$1 AND transaction_id=$2",[input.organizationId,input.transactionId]);
      await stageStoredFilesForDeletion(client,obsolete,{organizationId:input.organizationId,actorId:actor.id,reasonCode:"draft_kind_changed"});
    }
    const row = (old ? await client.query(
      `UPDATE inventory_transactions SET warehouse_id=$3,kind=$4,occurred_on=$5,draft_payload=$6::jsonb,draft_step=$7,updated_at=now(),draft_expires_at=now()+interval '7 days',version=version+1
       WHERE organization_id=$1 AND id=$2 RETURNING id,version,updated_at`,
      [input.organizationId,input.transactionId,input.warehouseId || null,input.kind || "receipt",input.occurredOn || null,JSON.stringify(payload),input.currentStep || 0],
    ) : await client.query(
      `INSERT INTO inventory_transactions(id,organization_id,warehouse_id,kind,status,occurred_on,draft_payload,created_by_user_id,draft_expires_at,draft_step)
       VALUES($1,$2,$3,$4,'draft',$5,$6::jsonb,$7,now()+interval '7 days',$8) RETURNING id,version,updated_at`,
      [input.transactionId,input.organizationId,input.warehouseId || null,input.kind || "receipt",input.occurredOn || null,JSON.stringify(payload),actor.id,input.currentStep || 0],
    )).rows[0];
    await writeAudit(client,{ organizationId:input.organizationId,actorUserId:actor.id,action:"inventory.transaction.draft",entityType:"inventory_transaction",entityId:row.id,afterData:{warehouseId:input.warehouseId || null,kind:input.kind || null},requestId });
    return row;
  });
}

const draftFileKinds = {
  purchase_proof: "inventory_purchase_proof",
  request_document: "inventory_request_document",
  handover_photo: "inventory_handover_photo",
};

export async function storeTransactionDraftFile({organizationId,transactionId,purpose,file,actor,requestId}) {
  const fileKind = draftFileKinds[purpose];
  if (!fileKind) fail("FILE_PURPOSE_INVALID","Jenis lampiran tidak sesuai transaksi.",400);
  const prepared = await prepareEmployeeFileUpload({file,fileKind,employeeId:null,organizationId});
  try {
    await finalizePreparedEmployeeFile(prepared);
    return await withTransaction(async (client) => {
      const draft = (await client.query(`SELECT id,kind,warehouse_id,draft_expires_at FROM inventory_transactions
        WHERE organization_id=$1 AND id=$2 AND created_by_user_id=$3 AND status='draft' AND draft_discarded_at IS NULL FOR UPDATE`,[organizationId,transactionId,actor.id])).rows[0];
      if (!draft || new Date(draft.draft_expires_at)<=new Date()) fail("DRAFT_UNAVAILABLE","Draft tidak tersedia atau kedaluwarsa.",409);
      await requireInventoryAccess(actor,organizationId,"inventory.transactions.create",draft.warehouse_id,client);
      if ((draft.kind === "receipt" && purpose !== "purchase_proof") || (draft.kind === "issue" && purpose === "purchase_proof") || !["receipt","issue"].includes(draft.kind))
        fail("FILE_PURPOSE_INVALID","Lampiran tidak sesuai jenis transaksi yang dipilih.",400);
      const previous = (await client.query(`SELECT file.id::text,file.object_key FROM inventory_transaction_files linked
        JOIN stored_files file ON file.organization_id=linked.organization_id AND file.id=linked.file_id
        WHERE linked.organization_id=$1 AND linked.transaction_id=$2 AND linked.purpose=$3 AND file.lifecycle_status='draft' FOR UPDATE OF file`,[organizationId,transactionId,purpose])).rows;
      await client.query("DELETE FROM inventory_transaction_files WHERE organization_id=$1 AND transaction_id=$2 AND purpose=$3",[organizationId,transactionId,purpose]);
      await stageStoredFilesForDeletion(client,previous,{organizationId,actorId:actor.id,reasonCode:"draft_file_replaced"});
      const stored = await insertPreparedEmployeeFile(client,prepared,{employeeId:null,organizationId,actor,requestId});
      await client.query(`UPDATE stored_files SET lifecycle_status='draft',inventory_transaction_draft_id=$3,draft_slot=$4
        WHERE organization_id=$1 AND id=$2`,[organizationId,stored.id,transactionId,purpose]);
      await client.query("INSERT INTO inventory_transaction_files(organization_id,transaction_id,file_id,purpose) VALUES($1,$2,$3,$4)",[organizationId,transactionId,stored.id,purpose]);
      await client.query("UPDATE inventory_transactions SET updated_at=now(),draft_expires_at=now()+interval '7 days' WHERE organization_id=$1 AND id=$2",[organizationId,transactionId]);
      return {id:stored.id,purpose,name:stored.original_name,mimeType:stored.mime_type,sizeBytes:stored.size_bytes};
    });
  } catch(error) {await discardPreparedEmployeeFile(prepared);throw error;}
}

export async function discardTransactionDraft(organizationId,transactionId,actor,requestId,{expired=false}={}) {
  return withTransaction(async(client)=>{
    const draft=(await client.query(`SELECT warehouse_id,draft_expires_at FROM inventory_transactions
      WHERE organization_id=$1 AND id=$2 AND created_by_user_id=$3 AND status='draft' AND draft_discarded_at IS NULL FOR UPDATE`,[organizationId,transactionId,actor.id])).rows[0];
    if (!draft) fail("DRAFT_UNAVAILABLE","Draft tidak tersedia.",404);
    if (!expired) await requireInventoryAccess(actor,organizationId,"inventory.transactions.create",draft.warehouse_id,client);
    if (expired && new Date(draft.draft_expires_at)>new Date()) return false;
    const files=(await client.query(`SELECT file.id::text,file.object_key FROM inventory_transaction_files linked
      JOIN stored_files file ON file.organization_id=linked.organization_id AND file.id=linked.file_id
      WHERE linked.organization_id=$1 AND linked.transaction_id=$2 AND file.lifecycle_status='draft' FOR UPDATE OF file`,[organizationId,transactionId])).rows;
    await client.query("DELETE FROM inventory_transaction_files WHERE organization_id=$1 AND transaction_id=$2",[organizationId,transactionId]);
    await stageStoredFilesForDeletion(client,files,{organizationId,actorId:actor.id,reasonCode:expired?"draft_expired":"draft_discarded"});
    await client.query("UPDATE inventory_transactions SET draft_discarded_at=now(),draft_payload=NULL,updated_at=now() WHERE organization_id=$1 AND id=$2",[organizationId,transactionId]);
    await writeAudit(client,{organizationId,actorUserId:actor.id,action:expired?"inventory.transaction.draft_expire":"inventory.transaction.draft_discard",entityType:"inventory_transaction",entityId:transactionId,afterData:{fileCount:files.length},requestId});
    return true;
  });
}

export async function removeTransactionDraftFile({organizationId,transactionId,fileId,actor,requestId}) {
  return withTransaction(async(client)=>{
    const draft=(await client.query(`SELECT warehouse_id FROM inventory_transactions WHERE organization_id=$1 AND id=$2
      AND created_by_user_id=$3 AND status='draft' AND draft_discarded_at IS NULL AND draft_expires_at>now() FOR UPDATE`,[organizationId,transactionId,actor.id])).rows[0];
    if(!draft)fail("DRAFT_UNAVAILABLE","Draft tidak tersedia.",404);
    await requireInventoryAccess(actor,organizationId,"inventory.transactions.create",draft.warehouse_id,client);
    const file=(await client.query(`SELECT stored.id::text,stored.object_key FROM inventory_transaction_files linked
      JOIN stored_files stored ON stored.organization_id=linked.organization_id AND stored.id=linked.file_id
      WHERE linked.organization_id=$1 AND linked.transaction_id=$2 AND linked.file_id=$3 AND stored.lifecycle_status='draft' FOR UPDATE OF stored`,[organizationId,transactionId,fileId])).rows[0];
    if(!file)fail("FILE_NOT_FOUND","Lampiran draft tidak ditemukan.",404);
    await client.query("DELETE FROM inventory_transaction_files WHERE organization_id=$1 AND transaction_id=$2 AND file_id=$3",[organizationId,transactionId,fileId]);
    await stageStoredFilesForDeletion(client,[file],{organizationId,actorId:actor.id,reasonCode:"draft_file_removed"});
    await writeAudit(client,{organizationId,actorUserId:actor.id,action:"inventory.transaction.draft_file_remove",entityType:"stored_file",entityId:fileId,afterData:{transactionId},requestId});
    return true;
  });
}

async function prepareStockChanges(client,input,links,sources,actor) {
  const warehouse=(await client.query("SELECT name FROM inventory_warehouses WHERE organization_id=$1 AND id=$2",[input.organizationId,input.warehouseId])).rows[0];
  const corrections=await prepareOpeningCorrections(client,input,actor);
  const changes=[];
  for(const [index,line] of input.lines.entries()) {
    const item=links.find((row)=>row.item_id===String(line.itemId));
    const facts={item:item.name,warehouse:warehouse.name,unit:item.unit_name,date:input.occurredOn};
    const field=`lines.${index}.quantity`;
    facts.field=field;
    const reject=(code,extra={})=>{const message=stockMessage(code,{...facts,...extra});fail(code,message,409,{[field]:message,lines:message});};
    const quantity=milli(line.quantity);
    if(!item.allows_fractional && quantity%1000n!==0n)fail("FRACTION_NOT_ALLOWED",`${item.name} memakai satuan utuh. Masukkan bilangan bulat.`,400,{[field]:"Jumlah harus bilangan bulat."});
    if(!["opening","stocktake"].includes(input.kind)&&quantity<=0n)fail("QUANTITY_REQUIRED",`Jumlah ${item.name} harus lebih dari 0.`,400,{[field]:"Jumlah harus lebih dari 0."});
    const state=await readReplay(client,input.organizationId,input.warehouseId,line.itemId);
    await ensureLegacyCompatible(client,input.organizationId,input.warehouseId,line.itemId,state,facts);
    checkFingerprint(state,input.calculationVersions?.find((entry)=>String(entry.itemId)===String(line.itemId)));
    const manual=state.rows.find((row)=>row.kind==="opening");
    const correction=corrections.find((entry)=>String(entry.itemId)===String(line.itemId)) || state.revision;
    const openingDate=correction?.occurredOn || manual?.occurredOn;
    if(input.kind==="opening" && manual)reject("OPENING_EXISTS");
    if(input.kind==="opening" && state.rows.length)reject("HISTORY_STARTED");
    if(!["opening","receipt"].includes(input.kind)&&!state.rows.length)reject("HISTORY_REQUIRED");
    if(openingDate && input.occurredOn<openingDate)reject("BEFORE_OPENING",{openingDate});
    const today=await todayForOrganization(client,input.organizationId);
    if(input.occurredOn<today && state.rows.some((row)=>row.kind==="stocktake" && row.occurredOn===input.occurredOn))reject("SAME_DAY_STOCKTAKE");
    const before=calculate(state.rows,state.revision,facts);
    // A linked receipt can repair a later shortage caused by reducing the opening.
    // Validate the prefix first, then replay the entire history with the receipt.
    const prefix=state.rows.filter((row)=>(row.kind==="opening"&&correction?correction.occurredOn:row.occurredOn)<=input.occurredOn);
    const atDate=milli(calculate(prefix,correction,facts).quantity);
    const source=sources.get(String(line.itemId));
    if(input.kind==="return" && source && dateOf(source.occurred_on)>input.occurredOn)fail("RETURN_DATE_INVALID","Tanggal pengembalian tidak boleh lebih awal dari tanggal penyaluran sebelumnya.",400,{occurredOn:"Pilih tanggal pada atau setelah penyaluran sebelumnya."});
    if(input.kind==="return" && (!source||quantity>milli(source.quantity)-milli(source.returned)))fail("RETURN_EXCEEDS_ISSUE",`Jumlah pengembalian ${item.name} melebihi sisa yang dapat dikembalikan.`,409,{[field]:"Kurangi jumlah sesuai sisa penyaluran."});
    if(input.kind==="issue" && quantity>atDate)fail("INSUFFICIENT_STOCK",stockMessage("INSUFFICIENT_STOCK",{...facts,quantity:decimal(atDate)}),409,{[field]:`Stok tersedia ${formatStockQuantity(decimal(atDate))} ${item.unit_name}.`});
    const delta=input.kind==="issue"?-quantity:input.kind==="stocktake"?quantity-atDate:quantity;
    const proposed={id:String(state.rows.reduce((max,row)=>BigInt(row.id)>max?BigInt(row.id):max,0n)+1n),lineId:"proposed",transactionId:input.transactionId,occurredOn:input.occurredOn,kind:input.kind,quantity:decimal(quantity),delta:decimal(delta)};
    const after=calculate([...state.rows,proposed],correction,facts);
    const effective=after.rows.find((row)=>row.lineId==="proposed");
    changes.push({itemId:line.itemId,quantity:decimal(quantity),delta:effective.effectiveDelta,sourceLineId:source?.line_id||null,
      beforeDate:decimal(atDate),afterDate:effective.balance,currentBefore:before.quantity,currentAfter:after.quantity,
      version:state.version,fingerprint:state.fingerprint,
      correctionHistory:corrections.some((entry)=>String(entry.itemId)===String(line.itemId))?after.rows.map((row)=>({kind:row.kind,occurredOn:row.effectiveDate,originalDelta:row.delta,effectiveDelta:row.effectiveDelta,balance:row.balance})):undefined,
      checkpoints:after.rows.filter((row)=>row.kind==="stocktake").map((row)=>({transactionId:row.transactionId,occurredOn:row.effectiveDate,originalDelta:row.delta,effectiveDelta:row.effectiveDelta}))});
  }
  return changes;
}

/** Preview performs the same replay without saving ledger, revisions, or stock. */
export async function previewTransaction(input,actor) {
  return withTransaction(async(client)=>{
    await requireInventoryAccess(actor,input.organizationId,"inventory.transactions.create",input.warehouseId,client);
    const today=await todayForOrganization(client,input.organizationId);
    validateDate(input.occurredOn,today,input.lateReason,input.kind);
    const sources=await getSourceLines(client,input);
    const {links}=await lockWarehouseAndItems(client,input);
    await checkDestination(client,input);
    const changes=await prepareStockChanges(client,input,links,sources,actor);
    return {occurredOn:input.occurredOn,asOf:today,lines:changes.map((change)=>({...change,itemId:String(change.itemId),
      name:links.find((item)=>item.item_id===String(change.itemId)).name,unit:links.find((item)=>item.item_id===String(change.itemId)).unit_name})),
      calculationVersions:changes.map(({itemId,version,fingerprint})=>({itemId,version,fingerprint}))};
  });
}

export async function postTransaction(input, actor, requestId, uploads = []) {
  const allowedFiles = input.kind === "receipt" ? ["purchase_proof"] : input.kind === "issue" ? ["request_document","handover_photo"] : [];
  if (uploads.some((upload) => !allowedFiles.includes(upload.purpose))) fail("ATTACHMENT_NOT_ALLOWED","Lampiran tidak sesuai jenis transaksi.",400);
  const prepared = [];
  try {
    for (const upload of uploads) prepared.push({purpose:upload.purpose,file:await prepareEmployeeFileUpload({file:upload.file,fileKind:upload.fileKind,employeeId:null,organizationId:input.organizationId})});
    const result = await withTransaction(async (client) => {
      const existing = (await client.query("SELECT id,status,created_by_user_id,version,draft_discarded_at,draft_expires_at FROM inventory_transactions WHERE organization_id=$1 AND id=$2 FOR UPDATE",[input.organizationId,input.transactionId])).rows[0];
      if (existing?.status === "posted") {
        if (String(existing.created_by_user_id) !== String(actor.id)) fail("TRANSACTION_ID_USED", "Nomor permintaan sudah digunakan.", 409);
        const previous = await getTransaction(input.organizationId,actor,input.transactionId,client);
        const same = previous.kind===input.kind && previous.warehouse_id===String(input.warehouseId)
          && dateOf(previous.occurred_on)===input.occurredOn
          && (previous.reference_no || "")===(input.referenceNo || "")
          && (previous.notes || "")===(input.notes || "")
          && (previous.late_reason || "")===(input.lateReason || "")
          && (previous.destination_location_id || "")===(input.destinationLocationId?String(input.destinationLocationId):"")
          && (previous.destination_unit_id || "")===(input.destinationUnitId?String(input.destinationUnitId):"")
          && (previous.recipient_employee_id || "")===(input.recipientEmployeeId?String(input.recipientEmployeeId):"")
          && (previous.source_transaction_id || "")===(input.sourceTransactionId || "")
          && previous.lines.length===input.lines.length
          && input.lines.every((line)=>previous.lines.some((saved)=>saved.itemId===String(line.itemId)&&milli(saved.quantity)===milli(line.quantity)));
        if (!same) fail("TRANSACTION_ID_USED","Nomor permintaan sudah digunakan untuk isi transaksi yang berbeda.",409);
        if (input.openingCorrections?.length) {
          const revisions=(await client.query(`SELECT item_id::text,to_char(occurred_on,'YYYY-MM-DD') AS occurred_on,quantity::text,reason
            FROM inventory_opening_revisions WHERE organization_id=$1 AND warehouse_id=$2 AND operation_id=$3`,[input.organizationId,input.warehouseId,input.transactionId])).rows;
          if(revisions.length!==input.openingCorrections.length || input.openingCorrections.some((correction)=>!revisions.some((revision)=>revision.item_id===String(correction.itemId)&&revision.occurred_on===correction.occurredOn&&milli(revision.quantity)===milli(correction.quantity)&&revision.reason===correction.reason)))
            fail("TRANSACTION_ID_USED","Permintaan sudah tersimpan dengan koreksi stok awal yang berbeda.",409);
        }
        return previous;
      }
    if (existing && (String(existing.created_by_user_id) !== String(actor.id) || existing.draft_discarded_at || new Date(existing.draft_expires_at)<=new Date())) fail("DRAFT_UNAVAILABLE", "Draft tidak tersedia atau sudah kedaluwarsa.", 409);
      if (existing && existing.version !== input.version) fail("VERSION_CONFLICT", "Draft telah berubah. Muat ulang sebelum memposting.",409);
      if (existing) {
        const draftFiles=(await client.query(`SELECT linked.purpose FROM inventory_transaction_files linked
          JOIN stored_files file ON file.organization_id=linked.organization_id AND file.id=linked.file_id
          WHERE linked.organization_id=$1 AND linked.transaction_id=$2 AND file.lifecycle_status='draft'`,[input.organizationId,input.transactionId])).rows;
        if (draftFiles.some((entry)=>!allowedFiles.includes(entry.purpose))) fail("ATTACHMENT_NOT_ALLOWED","Lampiran draft tidak sesuai jenis transaksi. Hapus atau ganti lampiran sebelum mencatat.",409);
      }
      await requireInventoryAccess(actor,input.organizationId,"inventory.transactions.create",input.warehouseId,client);
      const today = await todayForOrganization(client,input.organizationId);
      validateDate(input.occurredOn,today,input.lateReason,input.kind);
      const sources = await getSourceLines(client,input);
      const { links } = await lockWarehouseAndItems(client,input);
      await checkDestination(client,input);
      const changes = await prepareStockChanges(client,input,links,sources,actor);
      await saveOpeningCorrections(client,input,actor,requestId);
      if (existing) await client.query(
        `UPDATE inventory_transactions SET warehouse_id=$3,kind=$4,status='posted',occurred_on=$5,recorded_at=now(),reference_no=$6,notes=$7,late_reason=$8,
           destination_location_id=$9,destination_unit_id=$10,recipient_employee_id=$11,source_transaction_id=$12,draft_payload=NULL,draft_expires_at=NULL,version=version+1
         WHERE organization_id=$1 AND id=$2`,
        [input.organizationId,input.transactionId,input.warehouseId,input.kind,input.occurredOn,input.referenceNo || null,input.notes || null,input.lateReason || null,input.destinationLocationId || null,input.destinationUnitId || null,input.recipientEmployeeId || null,input.sourceTransactionId || null],
      );
      else await client.query(
        `INSERT INTO inventory_transactions(id,organization_id,warehouse_id,kind,status,occurred_on,recorded_at,reference_no,notes,late_reason,
          destination_location_id,destination_unit_id,recipient_employee_id,source_transaction_id,created_by_user_id)
         VALUES($1,$2,$3,$4,'posted',$5,now(),$6,$7,$8,$9,$10,$11,$12,$13)`,
        [input.transactionId,input.organizationId,input.warehouseId,input.kind,input.occurredOn,input.referenceNo || null,input.notes || null,input.lateReason || null,input.destinationLocationId || null,input.destinationUnitId || null,input.recipientEmployeeId || null,input.sourceTransactionId || null,actor.id],
      );
      for (const change of changes) {
        const line = (await client.query(
          `INSERT INTO inventory_transaction_lines(organization_id,transaction_id,item_id,quantity,delta,source_line_id)
           VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,
          [input.organizationId,input.transactionId,change.itemId,change.quantity,change.delta,change.sourceLineId],
        )).rows[0];
        if (input.kind === "opening") await client.query(
          "INSERT INTO inventory_stock_openings(organization_id,warehouse_id,item_id,transaction_id,occurred_on) VALUES($1,$2,$3,$4,$5)",
          [input.organizationId,input.warehouseId,change.itemId,input.transactionId,input.occurredOn],
        );
        await client.query(
          `INSERT INTO inventory_stock_movements(organization_id,warehouse_id,item_id,transaction_id,line_id,occurred_on,delta)
           VALUES($1,$2,$3,$4,$5,$6,$7)`,
          [input.organizationId,input.warehouseId,change.itemId,input.transactionId,line.id,input.occurredOn,change.delta],
        );
        change.balance = await validateHistoryAndBalance(client,input,change.itemId);
      }
      for (const attachment of prepared) {
        await finalizePreparedEmployeeFile(attachment.file);
        const stored = await insertPreparedEmployeeFile(client,attachment.file,{employeeId:null,organizationId:input.organizationId,actor,requestId});
        await client.query(
          "INSERT INTO inventory_transaction_files(organization_id,transaction_id,file_id,purpose) VALUES($1,$2,$3,$4)",
          [input.organizationId,input.transactionId,stored.id,attachment.purpose],
        );
      }
      if (existing) await client.query(`UPDATE stored_files SET lifecycle_status='active',inventory_transaction_draft_id=NULL,draft_slot=NULL
        WHERE organization_id=$1 AND inventory_transaction_draft_id=$2 AND lifecycle_status='draft'`,[input.organizationId,input.transactionId]);
      await writeAudit(client,{organizationId:input.organizationId,actorUserId:actor.id,action:"inventory.transaction.post",entityType:"inventory_transaction",entityId:input.transactionId,afterData:{kind:input.kind,warehouseId:input.warehouseId,occurredOn:input.occurredOn,changes},requestId});
      return getTransaction(input.organizationId,actor,input.transactionId,client);
    });
    await Promise.all(prepared.filter((entry)=>!entry.file.finalized).map((entry)=>discardPreparedEmployeeFile(entry.file)));
    return result;
  } catch (error) {
    await Promise.all(prepared.map((entry)=>discardPreparedEmployeeFile(entry.file)));
    if (error.code === "23505") fail("TRANSACTION_CONFLICT", "Permintaan ini bertabrakan dengan penyimpanan lain. Muat ulang riwayat sebelum mencoba kembali.",409);
    throw error;
  }
}

export async function cancelTransaction(organizationId, id, reason, reversalId, actor, requestId) {
  return withTransaction(async (client) => {
    const original = (await client.query("SELECT id,warehouse_id,kind,status,occurred_on,created_by_user_id FROM inventory_transactions WHERE organization_id=$1 AND id=$2 FOR UPDATE",[organizationId,id])).rows[0];
    if (!original || original.status !== "posted" || original.kind === "reversal" || original.kind === "opening") fail("CANCELLATION_UNAVAILABLE", "Transaksi tidak dapat dibatalkan. Gunakan Koreksi stok awal untuk memperbaiki stok awal.",409);
    await requireInventoryAccess(actor,organizationId,"inventory.transactions.cancel",String(original.warehouse_id),client);
    const today = await todayForOrganization(client,organizationId);
    validateDate(dateOf(original.occurred_on),today,reason);
    const already = (await client.query("SELECT id FROM inventory_transactions WHERE organization_id=$1 AND reversal_of_id=$2",[organizationId,id])).rows[0];
    if (already) return { id: already.id, alreadyCancelled: true };
    const lines = (await client.query("SELECT item_id::text,quantity::text,delta::text FROM inventory_transaction_lines WHERE organization_id=$1 AND transaction_id=$2 ORDER BY item_id",[organizationId,id])).rows;
    for (const line of lines) await client.query("SELECT 1 FROM inventory_item_warehouses WHERE organization_id=$1 AND warehouse_id=$2 AND item_id=$3 FOR UPDATE",[organizationId,original.warehouse_id,line.item_id]);
    if (original.kind === "issue") {
      const returned = await client.query(
        `SELECT 1 FROM inventory_transaction_lines returned JOIN inventory_transactions tx ON tx.organization_id=returned.organization_id AND tx.id=returned.transaction_id
         JOIN inventory_transaction_lines source ON source.organization_id=returned.organization_id AND source.id=returned.source_line_id
         WHERE source.organization_id=$1 AND source.transaction_id=$2 AND tx.status='posted'
           AND NOT EXISTS(SELECT 1 FROM inventory_transactions reversal WHERE reversal.organization_id=tx.organization_id AND reversal.reversal_of_id=tx.id) LIMIT 1`,[organizationId,id],
      );
      if (returned.rowCount) fail("ISSUE_HAS_RETURNS", "Batalkan pengembalian terkait terlebih dahulu sebelum membatalkan barang keluar.",409);
    }
    await client.query(
      `INSERT INTO inventory_transactions(id,organization_id,warehouse_id,kind,status,occurred_on,recorded_at,notes,reversal_of_id,created_by_user_id)
       VALUES($1,$2,$3,'reversal','posted',$4,now(),$5,$6,$7)`,[reversalId,organizationId,original.warehouse_id,today,reason,id,actor.id],
    );
    const balances = [];
    for (const line of lines) {
      const state=await readReplay(client,organizationId,original.warehouse_id,line.item_id);
      await ensureLegacyCompatible(client,organizationId,original.warehouse_id,line.item_id,state,{item:line.item_id,warehouse:original.warehouse_id,unit:""});
      const effective=calculate(state.rows,state.revision,{item:line.item_id,warehouse:original.warehouse_id,unit:""}).rows.find((row)=>row.transactionId===id);
      const reverseDelta = decimal(-milli(effective.effectiveDelta));
      const reversalLine = (await client.query(
        `INSERT INTO inventory_transaction_lines(organization_id,transaction_id,item_id,quantity,delta)
         VALUES($1,$2,$3,$4,$5) RETURNING id`,[organizationId,reversalId,line.item_id,line.quantity,reverseDelta],
      )).rows[0];
      await client.query(
        `INSERT INTO inventory_stock_movements(organization_id,warehouse_id,item_id,transaction_id,line_id,occurred_on,delta)
         VALUES($1,$2,$3,$4,$5,$6,$7)`,[organizationId,original.warehouse_id,line.item_id,reversalId,reversalLine.id,today,reverseDelta],
      );
      balances.push({itemId:line.item_id,balance:await validateHistoryAndBalance(client,{organizationId,warehouseId:original.warehouse_id},line.item_id)});
    }
    await writeAudit(client,{organizationId,actorUserId:actor.id,action:"inventory.transaction.cancel",entityType:"inventory_transaction",entityId:id,afterData:{reversalId,reason,balances},requestId});
    return {id:reversalId,balances};
  });
}
