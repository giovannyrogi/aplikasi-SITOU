import { recipientPositionJoin } from "./recipientPresentation.mjs";
import { actorIdentitySql } from "../identity/actorPresentation.mjs";
const actorIdentity = actorIdentitySql("account", "tx.organization_id");
/** Agregasi dari dokumen immutable, bukan saldo gudang atau penempatan Pegawai saat ini. */
export function distributionQuery(input, scope) {
  const values = [
    input.organizationId,
    scope,
    input.from,
    input.to,
    input.warehouseId || null,
    input.itemId || null,
    input.locationId || null,
    input.unitId || null,
    input.recipientId || null,
    input.search ? `%${input.search.replace(/[\\%_]/g, "\\$&")}%` : "",
    input.status,
  ];
  const sql = `WITH cancellations AS (
    SELECT reversal_of_id,occurred_on FROM inventory_transactions WHERE organization_id=$1 AND kind='reversal' AND status='posted' AND occurred_on<=$4::date AND ($2::bigint[] IS NULL OR warehouse_id=ANY($2::bigint[])) AND ($5::bigint IS NULL OR warehouse_id=$5)
  ), base AS (
    SELECT line.id AS line_id,tx.id AS transaction_id,tx.occurred_on,tx.warehouse_id,line.item_id,
      tx.destination_location_id AS location_id,tx.destination_unit_id AS unit_id,tx.recipient_employee_id AS recipient_id,
      tx.reference_no,line.quantity,warehouse.name AS warehouse_name,item.name AS item_name,item.code AS item_code,item.photo_file_id::text,
      unit.name AS unit_name,location.name AS location_name,division.name AS destination_unit_name,
      recipient.full_name AS recipient_name,recipient.profile_photo_file_id::text AS recipient_photo_file_id,recipient_assignment.position_name AS recipient_position_name,${actorIdentity.name} AS actor_name,${actorIdentity.photo} AS actor_photo_file_id,${actorIdentity.position} AS actor_position_name,tx.recorded_at,cancellation.occurred_on AS cancelled_on
    FROM inventory_transactions tx JOIN inventory_transaction_lines line ON line.organization_id=tx.organization_id AND line.transaction_id=tx.id
    JOIN inventory_warehouses warehouse ON warehouse.organization_id=tx.organization_id AND warehouse.id=tx.warehouse_id
    JOIN inventory_items item ON item.organization_id=line.organization_id AND item.id=line.item_id
    JOIN inventory_units unit ON unit.organization_id=item.organization_id AND unit.id=item.unit_id
    LEFT JOIN locations location ON location.organization_id=tx.organization_id AND location.id=tx.destination_location_id
    LEFT JOIN organization_units division ON division.organization_id=tx.organization_id AND division.id=tx.destination_unit_id
    LEFT JOIN employees recipient ON recipient.organization_id=tx.organization_id AND recipient.id=tx.recipient_employee_id ${recipientPositionJoin}
    JOIN users account ON account.id=tx.created_by_user_id ${actorIdentity.joins} LEFT JOIN cancellations cancellation ON cancellation.reversal_of_id=tx.id
    WHERE tx.organization_id=$1 AND tx.kind='issue' AND tx.status='posted' AND tx.occurred_on BETWEEN $3::date AND $4::date
      AND ($2::bigint[] IS NULL OR tx.warehouse_id=ANY($2::bigint[]))
      AND ($5::bigint IS NULL OR tx.warehouse_id=$5) AND ($6::bigint IS NULL OR line.item_id=$6)
      AND ($7::bigint IS NULL OR tx.destination_location_id=$7) AND ($8::bigint IS NULL OR tx.destination_unit_id=$8)
      AND ($9::bigint IS NULL OR tx.recipient_employee_id=$9)
      AND ($10='' OR item.name ILIKE $10 ESCAPE '\\' OR item.code ILIKE $10 ESCAPE '\\' OR tx.reference_no ILIKE $10 ESCAPE '\\' OR recipient.full_name ILIKE $10 ESCAPE '\\')
  ), returns AS (
    SELECT returned.source_line_id,sum(returned.quantity) AS quantity FROM inventory_transaction_lines returned
    JOIN inventory_transactions tx ON tx.organization_id=returned.organization_id AND tx.id=returned.transaction_id
    JOIN base ON base.line_id=returned.source_line_id LEFT JOIN cancellations cancellation ON cancellation.reversal_of_id=tx.id
    WHERE returned.organization_id=$1 AND tx.kind='return' AND tx.status='posted' AND tx.occurred_on<=$4::date AND cancellation.reversal_of_id IS NULL
    GROUP BY returned.source_line_id
  ), effective AS (
    SELECT base.line_id,base.transaction_id,base.occurred_on,base.warehouse_id,base.item_id,base.location_id,base.unit_id,base.recipient_id,base.reference_no,base.quantity,base.warehouse_name,base.item_name,base.item_code,base.photo_file_id,base.unit_name,base.location_name,base.destination_unit_name,base.recipient_name,base.recipient_photo_file_id,base.recipient_position_name,base.actor_name,base.actor_photo_file_id,base.actor_position_name,base.recorded_at,base.cancelled_on,CASE WHEN cancelled_on IS NULL THEN base.quantity ELSE 0 END AS distributed_quantity,
      COALESCE(returns.quantity,0) AS returned_quantity,
      CASE WHEN cancelled_on IS NULL THEN base.quantity ELSE 0 END-COALESCE(returns.quantity,0) AS net_quantity
    FROM base LEFT JOIN returns ON returns.source_line_id=base.line_id
  ), filtered AS (SELECT line_id,transaction_id,occurred_on,warehouse_id,item_id,location_id,unit_id,recipient_id,reference_no,quantity,warehouse_name,item_name,item_code,photo_file_id,unit_name,location_name,destination_unit_name,recipient_name,recipient_photo_file_id,recipient_position_name,actor_name,actor_photo_file_id,actor_position_name,recorded_at,cancelled_on,distributed_quantity,returned_quantity,net_quantity FROM effective WHERE $11='all' OR ($11='cancelled')=(cancelled_on IS NOT NULL))`;
  return { sql, values };
}
const detailSelect = `line_id::text AS id,transaction_id,to_char(occurred_on,'YYYY-MM-DD') AS occurred_on,warehouse_id::text,item_id::text,location_id::text,unit_id::text,recipient_id::text,
  warehouse_name,item_name,item_code,photo_file_id,unit_name,location_name,destination_unit_name,recipient_name,recipient_photo_file_id,recipient_position_name,reference_no,actor_name,actor_photo_file_id,actor_position_name,recorded_at,
  quantity::text AS original_quantity,round(distributed_quantity,3)::text AS distributed_quantity,round(returned_quantity,3)::text AS returned_quantity,round(net_quantity,3)::text AS net_quantity,to_char(cancelled_on,'YYYY-MM-DD') AS cancelled_on`;
/** Cursor memakai urutan tanggal, transaksi, dan baris barang; tidak memakai offset. */
export async function readDistribution(
  database,
  input,
  scope,
  after = null,
  limit = input.pageSize + 1,
) {
  const { sql, values } = distributionQuery(input, scope);
  return (
    await database.query(
      `${sql} SELECT ${detailSelect} FROM filtered
    WHERE $12::date IS NULL OR (occurred_on,transaction_id,line_id)<($12::date,$13::uuid,$14::bigint)
    ORDER BY occurred_on DESC,transaction_id DESC,line_id DESC LIMIT $15`,
      [...values, ...(after || [null, null, null]), limit],
    )
  ).rows;
}
/** Statistik jumlah entitas; tidak menjumlahkan kuantitas lintas satuan. */
export async function readDistributionTotals(database, input, scope) {
  const { sql, values } = distributionQuery(input, scope);
  return (await database.query(`${sql} SELECT count(*)::int AS detail_count FROM filtered`, values))
    .rows[0];
}
/** Pilihan hanya berasal dari histori yang dapat dibaca; data nonaktif tetap dapat ditelusuri. */
export async function readDistributionOptions(database, org, scope) {
  return (
    await database.query(
      `SELECT DISTINCT tx.warehouse_id::text,warehouse.name AS warehouse_name,warehouse.is_active,
    line.item_id::text,item.name AS item_name,item.code AS item_code,unit.name AS unit_name,tx.destination_location_id::text AS location_id,location.name AS location_name,
    tx.destination_unit_id::text AS unit_id,division.name AS destination_unit_name,tx.recipient_employee_id::text AS recipient_id,recipient.full_name AS recipient_name
    FROM inventory_transactions tx JOIN inventory_transaction_lines line ON line.organization_id=tx.organization_id AND line.transaction_id=tx.id
    JOIN inventory_warehouses warehouse ON warehouse.organization_id=tx.organization_id AND warehouse.id=tx.warehouse_id
    JOIN inventory_items item ON item.organization_id=line.organization_id AND item.id=line.item_id
    JOIN inventory_units unit ON unit.organization_id=item.organization_id AND unit.id=item.unit_id
    LEFT JOIN locations location ON location.organization_id=tx.organization_id AND location.id=tx.destination_location_id
    LEFT JOIN organization_units division ON division.organization_id=tx.organization_id AND division.id=tx.destination_unit_id
    LEFT JOIN employees recipient ON recipient.organization_id=tx.organization_id AND recipient.id=tx.recipient_employee_id
    WHERE tx.organization_id=$1 AND tx.status='posted' AND tx.kind='issue' AND ($2::bigint[] IS NULL OR tx.warehouse_id=ANY($2::bigint[]))`,
      [org, scope],
    )
  ).rows;
}
