import { actorIdentitySql } from "../identity/actorPresentation.mjs";
const actorIdentity = actorIdentitySql("account", "transaction.organization_id");
import pool from "@/lib/dbConfig";

/** Sumber kondisi/saldo bersama daftar stok dan Dashboard. Parameter $1–$6 sama. */
export const STOCK_SOURCE_SQL = `
    SELECT link.item_id,link.warehouse_id,item.code,item.name,item.photo_file_id::text,
      category.name AS category_name,unit.name AS unit_name,unit.allows_fractional,
      warehouse.name AS warehouse_name,warehouse.code AS warehouse_code,location.name AS location_name,
      (link.is_active AND item.is_active AND warehouse.is_active) AS is_active,
      link.is_active AS link_active,link.version,link.minimum_stock::text,
      opening.item_id IS NOT NULL AS has_opening,balance.item_id IS NOT NULL AS has_history,to_char(COALESCE(revision.occurred_on,opening.occurred_on),'YYYY-MM-DD') AS opening_date,
      CASE WHEN balance.item_id IS NOT NULL THEN balance.quantity::text END AS quantity,
      CASE WHEN balance.item_id IS NULL THEN 'unrecorded' WHEN COALESCE(balance.quantity,0)=0 THEN 'empty'
        WHEN balance.quantity<link.minimum_stock THEN 'low' ELSE 'sufficient' END AS condition
    FROM inventory_item_warehouses link
    JOIN inventory_items item ON item.organization_id=link.organization_id AND item.id=link.item_id
    JOIN inventory_categories category ON category.organization_id=item.organization_id AND category.id=item.category_id
    JOIN inventory_units unit ON unit.organization_id=item.organization_id AND unit.id=item.unit_id
    JOIN inventory_warehouses warehouse ON warehouse.organization_id=link.organization_id AND warehouse.id=link.warehouse_id
    JOIN locations location ON location.organization_id=warehouse.organization_id AND location.id=warehouse.location_id
    LEFT JOIN inventory_stock_openings opening ON opening.organization_id=link.organization_id AND opening.warehouse_id=link.warehouse_id AND opening.item_id=link.item_id
    LEFT JOIN inventory_stock_balances balance ON balance.organization_id=link.organization_id AND balance.warehouse_id=link.warehouse_id AND balance.item_id=link.item_id
    LEFT JOIN LATERAL (SELECT occurred_on FROM inventory_opening_revisions WHERE organization_id=link.organization_id AND warehouse_id=link.warehouse_id AND item_id=link.item_id ORDER BY created_at DESC,id DESC LIMIT 1) revision ON true
    WHERE link.organization_id=$1 AND ($2::bigint[] IS NULL OR link.warehouse_id=ANY($2::bigint[]))
      AND ($3::bigint IS NULL OR link.warehouse_id=$3) AND ($4::bigint IS NULL OR item.category_id=$4)
      AND ($5::bigint IS NULL OR link.item_id=$5) AND ($6::text='' OR item.name ILIKE $6 OR item.code ILIKE $6)
`;

export async function readStockRows(input, scope, after, database = pool) {
  const values = [input.organizationId, scope, input.warehouseId || null, input.categoryId || null,
    input.itemId || null, input.search ? `%${input.search.replace(/[\\%_]/g, "\\$&")}%` : "",
    input.condition, input.status, after?.warehouseId || null, after?.itemId || null, input.pageSize + 1];
  return (await database.query(`WITH base AS (
${STOCK_SOURCE_SQL}
  ), filtered AS (SELECT * FROM base WHERE ($7='all' OR ($7='recorded' AND has_history) OR ($7='attention' AND condition IN ('low','empty')) OR condition=$7)
    AND ($8='all' OR is_active=($8='active'))), page AS (
    SELECT item_id::text,warehouse_id::text,code,name,photo_file_id,category_name,unit_name,allows_fractional,
      warehouse_name,warehouse_code,location_name,is_active,link_active,version,minimum_stock,has_opening,has_history,opening_date,quantity,condition
    FROM filtered WHERE $9::bigint IS NULL OR (warehouse_id,item_id)>($9::bigint,$10::bigint)
    ORDER BY warehouse_id,item_id LIMIT $11)
    SELECT (SELECT count(*)::int FROM filtered) AS total,
      COALESCE((SELECT jsonb_agg(page ORDER BY page.warehouse_id::bigint,page.item_id::bigint) FROM page),'[]'::jsonb) AS rows`, values)).rows[0];
}

export async function readStockOptions(org, scope, database = pool) {
  const warehouses = (await database.query(`SELECT warehouse.id::text,warehouse.name,location.name AS location_name,warehouse.is_active
    FROM inventory_warehouses warehouse JOIN locations location ON location.organization_id=warehouse.organization_id AND location.id=warehouse.location_id
    WHERE warehouse.organization_id=$1 AND ($2::bigint[] IS NULL OR warehouse.id=ANY($2::bigint[])) ORDER BY warehouse.name`, [org, scope])).rows;
  const categories = (await database.query(`SELECT DISTINCT category.id::text,category.name
    FROM inventory_categories category JOIN inventory_items item ON item.organization_id=category.organization_id AND item.category_id=category.id
    JOIN inventory_item_warehouses link ON link.organization_id=item.organization_id AND link.item_id=item.id
    WHERE category.organization_id=$1 AND ($2::bigint[] IS NULL OR link.warehouse_id=ANY($2::bigint[])) ORDER BY category.name`, [org, scope])).rows;
  return { warehouses, categories };
}

export async function readStockHistory(input, after, database = pool) {
  return (await database.query(`WITH ledger AS (
    SELECT movement.id,projection.effective_on AS occurred_on,projection.effective_delta AS delta,movement.delta AS original_delta,movement.occurred_on AS original_date,projection.balance,
      transaction.id AS transaction_id,transaction.kind,transaction.reference_no,transaction.recorded_at,${actorIdentity.name} AS actor_name,${actorIdentity.photo} AS actor_photo_file_id,${actorIdentity.position} AS actor_position_name
    FROM inventory_stock_movements movement JOIN inventory_stock_projection projection ON projection.organization_id=movement.organization_id AND projection.line_id=movement.line_id
    JOIN inventory_transactions transaction ON transaction.organization_id=movement.organization_id AND transaction.id=movement.transaction_id AND transaction.status='posted'
    JOIN users account ON account.id=transaction.created_by_user_id ${actorIdentity.joins}
    WHERE movement.organization_id=$1 AND movement.warehouse_id=$2 AND movement.item_id=$3
  ), filtered AS (SELECT * FROM ledger WHERE ($4::date IS NULL OR occurred_on>=$4::date) AND ($5::date IS NULL OR occurred_on<=$5::date)), page AS (
    SELECT id::text,to_char(occurred_on,'YYYY-MM-DD') AS occurred_on,delta::text,original_delta::text,to_char(original_date,'YYYY-MM-DD') AS original_date,balance::text,transaction_id,kind,reference_no,recorded_at,actor_name,actor_photo_file_id,actor_position_name
    FROM filtered WHERE $6::date IS NULL OR (occurred_on,id)>($6::date,$7::bigint)
    ORDER BY occurred_on,id LIMIT $8)
    SELECT (SELECT count(*)::int FROM filtered) AS total,
      COALESCE((SELECT sum(delta) FROM ledger WHERE occurred_on<$4::date),0)::text AS opening_balance,
      COALESCE((SELECT sum(delta) FROM ledger WHERE $5::date IS NULL OR occurred_on<=$5::date),0)::text AS closing_balance,
      COALESCE((SELECT jsonb_agg(page ORDER BY page.occurred_on,page.id::bigint) FROM page),'[]'::jsonb) AS rows`,
    [input.organizationId,input.warehouseId,input.itemId,input.from || null,input.to || null,after?.date || null,after?.id || null,input.pageSize+1])).rows[0];
}
