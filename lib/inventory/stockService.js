import { createHash } from "node:crypto";
import pool from "@/lib/dbConfig";
import { z } from "zod";
import { ServiceError } from "@/lib/api/routeHelpers";
import { requireInventoryAccess } from "./service";
import { readPermissionScope } from "@/lib/access/packageRepository";
import { hasScope } from "@/lib/access/packagePolicy.mjs";
import { readStockRows, readStockOptions, readStockHistory } from "./stockRepository";

function pageContext(input, scope, history) {
  const { cursor, ...filters } = input;
  const fingerprint = createHash("sha256").update(JSON.stringify({ filters, scope:scope === null ? null : [...scope].sort(), history })).digest("hex");
  let after = null;
  if (cursor) {
    try {
      const decoded = JSON.parse(Buffer.from(cursor,"base64url").toString());
      const ids = history ? [decoded.after.id] : [decoded.after.warehouseId,decoded.after.itemId];
      if (decoded.fingerprint !== fingerprint || ids.some((id) => !/^[1-9]\d{0,18}$/.test(id)) ||
        (history && !z.iso.date().safeParse(decoded.after.date).success)) throw new Error();
      after = decoded.after;
    } catch { throw new ServiceError("CURSOR_INVALID","Halaman tidak berlaku. Muat ulang daftar.",400,{cursor:"Muat ulang daftar."}); }
  }
  return { after, encode: (value) => Buffer.from(JSON.stringify({ fingerprint,after:value })).toString("base64url") };
}

export async function listStock(input, actor, database = pool) {
  const scope = await requireInventoryAccess(actor,input.organizationId,"inventory.stock.read",input.warehouseId,database);
  const context = pageContext(input,scope,false);
  const result = await readStockRows(input,scope,context.after,database);
  const edit = await readPermissionScope(actor,input.organizationId,"inventory.item_warehouses.update",database);
  const create = await readPermissionScope(actor,input.organizationId,"inventory.transactions.create",database);
  const correction = await readPermissionScope(actor,input.organizationId,"inventory.openings.correct",database);
  const rows = result.rows.slice(0,input.pageSize).map((row) => ({...row,id:`${row.warehouse_id}-${row.item_id}`,canManageMinimum:row.is_active && hasScope(edit,row.warehouse_id),canCorrectOpening:row.is_active && row.has_opening && hasScope(create,row.warehouse_id) && hasScope(correction,row.warehouse_id)}));
  const last = rows.at(-1);
  return { data:rows,total:result.total,pageSize:input.pageSize,
    nextCursor:result.rows.length>input.pageSize ? context.encode({warehouseId:last.warehouse_id,itemId:last.item_id}) : null,
    canCreate: create === null || create.length>0,
    ...await readStockOptions(input.organizationId,scope,database) };
}

export async function stockHistory(input, actor, database = pool) {
  const scope = await requireInventoryAccess(actor,input.organizationId,"inventory.stock.read",input.warehouseId,database);
  const item = (await readStockRows({...input,search:"",condition:"all",status:"all",pageSize:10},scope,null,database)).rows[0];
  if (!item) throw new ServiceError("NOT_FOUND","Barang tidak terdaftar pada gudang ini.",404);
  const context = pageContext(input,scope,true);
  const result = await readStockHistory(input,context.after,database);
  const rows = result.rows.slice(0,input.pageSize);
  const last = rows.at(-1);
  const transactionScope = await readPermissionScope(actor,input.organizationId,"inventory.transactions.read",database);
  return { ...result, rows, item, canReadTransaction:hasScope(transactionScope,input.warehouseId),
    nextCursor:result.rows.length>input.pageSize ? context.encode({date:last.occurred_on,id:last.id}) : null };
}
