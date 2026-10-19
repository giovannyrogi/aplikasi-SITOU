/** Ringkasan memakai proyeksi efektif yang juga dibaca Kartu Stok. */
export async function readStockReport(db, input, scope, after, limit) {
  const values = [
    input.organizationId,
    scope,
    input.from,
    input.to,
    input.warehouseId || null,
    input.categoryId || null,
    input.itemId || null,
    input.search ? `%${input.search.replace(/[\\%_]/g, "\\$&")}%` : "",
    after?.warehouseId || null,
    after?.itemId || null,
    limit,
  ];
  return (
    await db.query(
      `WITH effects AS (
 SELECT m.warehouse_id,m.item_id,p.effective_on,p.effective_delta
 FROM inventory_stock_movements m
 JOIN inventory_stock_projection p ON p.organization_id=m.organization_id AND p.line_id=m.line_id
 JOIN inventory_transactions tx ON tx.organization_id=m.organization_id AND tx.id=m.transaction_id AND tx.status='posted'
 WHERE m.organization_id=$1 AND ($2::bigint[] IS NULL OR m.warehouse_id=ANY($2))
 AND ($5::bigint IS NULL OR m.warehouse_id=$5) AND ($7::bigint IS NULL OR m.item_id=$7) AND p.effective_on<=$4::date
 ), totals AS (
 SELECT warehouse_id,item_id,COALESCE(sum(effective_delta) FILTER(WHERE effective_on<$3::date),0) AS opening_balance,
 COALESCE(sum(effective_delta) FILTER(WHERE effective_on>=$3::date AND effective_delta>0),0) AS incoming,
 COALESCE(-sum(effective_delta) FILTER(WHERE effective_on>=$3::date AND effective_delta<0),0) AS outgoing,
 sum(effective_delta) AS closing_balance
 FROM effects GROUP BY warehouse_id,item_id
 ), filtered AS (
 SELECT t.warehouse_id,t.item_id,w.name AS warehouse_name,i.name,i.code,i.photo_file_id::text AS photo_file_id,u.name AS unit_name,
 t.opening_balance::text,t.incoming::text,(t.opening_balance+t.incoming)::text AS available,t.outgoing::text,t.closing_balance::text
 FROM totals t JOIN inventory_items i ON i.organization_id=$1 AND i.id=t.item_id
 JOIN inventory_units u ON u.organization_id=i.organization_id AND u.id=i.unit_id
 JOIN inventory_warehouses w ON w.organization_id=$1 AND w.id=t.warehouse_id
 WHERE ($6::bigint IS NULL OR i.category_id=$6) AND ($8='' OR i.name ILIKE $8 OR i.code ILIKE $8)
 ), page AS (
 SELECT warehouse_id::text,item_id::text,warehouse_name,name,code,photo_file_id,unit_name,opening_balance,incoming,available,outgoing,closing_balance
 FROM filtered f WHERE $9::bigint IS NULL OR (f.warehouse_id,f.item_id)>($9::bigint,$10::bigint)
 ORDER BY f.warehouse_id,f.item_id LIMIT $11)
 SELECT (SELECT count(*)::int FROM filtered) AS total,COALESCE((SELECT jsonb_agg(page ORDER BY warehouse_id::bigint,item_id::bigint) FROM page),'[]'::jsonb) AS rows`,
      values,
    )
  ).rows[0];
}
export async function stockReportOptions(db, org, scope) {
  return (
    await db.query(
      `SELECT DISTINCT w.id::text AS warehouse_id,w.name AS warehouse_name,i.id::text AS item_id,i.name,i.code,i.photo_file_id::text AS photo_file_id,u.name AS unit_name,c.id::text AS category_id,c.name AS category_name
 FROM inventory_stock_movements m JOIN inventory_transactions tx ON tx.organization_id=m.organization_id AND tx.id=m.transaction_id AND tx.status='posted'
 JOIN inventory_warehouses w ON w.organization_id=m.organization_id AND w.id=m.warehouse_id
 JOIN inventory_items i ON i.organization_id=m.organization_id AND i.id=m.item_id
 JOIN inventory_units u ON u.organization_id=i.organization_id AND u.id=i.unit_id
 JOIN inventory_categories c ON c.organization_id=i.organization_id AND c.id=i.category_id
 WHERE m.organization_id=$1 AND ($2::bigint[] IS NULL OR m.warehouse_id=ANY($2)) ORDER BY w.name,i.name`,
      [org, scope],
    )
  ).rows;
}

/** Rincian report-only tidak membaca identitas pelaku, catatan, atau lampiran dokumen. */
export async function readStockReportHistory(db, input, after) {
  return (
    await db.query(
      `WITH filtered AS (
 SELECT m.id,p.effective_on,p.effective_delta,p.balance,tx.id AS transaction_id,tx.kind,tx.reference_no
 FROM inventory_stock_movements m
 JOIN inventory_stock_projection p ON p.organization_id=m.organization_id AND p.line_id=m.line_id
 JOIN inventory_transactions tx ON tx.organization_id=m.organization_id AND tx.id=m.transaction_id AND tx.status='posted'
 WHERE m.organization_id=$1 AND m.warehouse_id=$2 AND m.item_id=$3
 AND p.effective_on BETWEEN $4::date AND $5::date
 ), page AS (
 SELECT f.id::text,to_char(f.effective_on,'YYYY-MM-DD') AS occurred_on,f.effective_delta::text AS delta,f.balance::text,f.transaction_id,f.kind,f.reference_no
 FROM filtered f WHERE $6::date IS NULL OR (f.effective_on,f.id)>($6::date,$7::bigint)
 ORDER BY f.effective_on,f.id LIMIT $8)
 SELECT (SELECT count(*)::int FROM filtered) AS total,
 COALESCE((SELECT jsonb_agg(page ORDER BY occurred_on,id::bigint) FROM page),'[]'::jsonb) AS rows`,
      [
        input.organizationId,
        input.warehouseId,
        input.itemId,
        input.from,
        input.to,
        after?.date || null,
        after?.id || null,
        input.pageSize + 1,
      ],
    )
  ).rows[0];
}
