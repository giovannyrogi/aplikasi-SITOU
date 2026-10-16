import pool from "@/lib/dbConfig";
import { STOCK_SOURCE_SQL } from "../inventory/stockRepository";
import { actorIdentitySql } from "../identity/actorPresentation.mjs";

export async function readEmployeeDashboard(actor, allowed, database = pool) {
  return (await database.query(`SELECT employee.id::text,employee.full_name,employee.employee_no,
    employee.profile_photo_file_id::text,employee.employment_status,to_char(employee.joined_date,'YYYY-MM-DD') AS joined_date,
    organization.timezone,to_char((now() AT TIME ZONE organization.timezone)::date,'YYYY-MM-DD') AS today,
    placement.position_name,placement.location_name,placement.unit_name,
    contract.employment_type_name,contract.status AS contract_status,
    to_char(contract.start_date,'YYYY-MM-DD') AS contract_start,to_char(contract.end_date,'YYYY-MM-DD') AS contract_end,
    extract(year FROM age((now() AT TIME ZONE organization.timezone)::date,employee.joined_date))::int AS service_years,
    extract(month FROM age((now() AT TIME ZONE organization.timezone)::date,employee.joined_date))::int AS service_months
    FROM employees employee JOIN organizations organization ON organization.id=employee.organization_id
    LEFT JOIN LATERAL (
      SELECT position.name AS position_name,location.name AS location_name,unit.name AS unit_name
      FROM employee_assignments assignment
      JOIN locations location ON location.organization_id=assignment.organization_id AND location.id=assignment.location_id
      JOIN organization_units unit ON unit.organization_id=assignment.organization_id AND unit.id=assignment.organization_unit_id
      LEFT JOIN positions position ON position.organization_id=assignment.organization_id AND position.id=assignment.position_id
      WHERE assignment.organization_id=employee.organization_id AND assignment.employee_id=employee.id AND assignment.assignment_type='primary'
        AND $3::boolean AND assignment.effective_from<=(now() AT TIME ZONE organization.timezone)::date
        AND (assignment.effective_until IS NULL OR assignment.effective_until>=(now() AT TIME ZONE organization.timezone)::date)
      ORDER BY assignment.effective_from DESC,assignment.id DESC LIMIT 1
    ) placement ON true
    LEFT JOIN LATERAL (
      SELECT history.start_date,history.end_date,history.status,type.name AS employment_type_name
      FROM employment_contracts history JOIN employment_types type ON type.organization_id=history.organization_id AND type.id=history.employment_type_id
      WHERE $4::boolean AND history.organization_id=employee.organization_id AND history.employee_id=employee.id AND history.status NOT IN ('draft','cancelled')
      ORDER BY CASE WHEN history.status='active' AND history.start_date<=(now() AT TIME ZONE organization.timezone)::date
        AND (history.end_date IS NULL OR history.end_date>=(now() AT TIME ZONE organization.timezone)::date) THEN 0 ELSE 1 END,
        history.start_date DESC,history.id DESC LIMIT 1
    ) contract ON true
    WHERE employee.organization_id=$1 AND employee.user_id=$2 AND employee.deleted_at IS NULL`, [actor.organization_id, actor.id, allowed[1], allowed[2]])).rows[0];
}

export async function readInventoryDashboardStock(org, scope, warehouseId, database = pool) {
  return (await database.query(`WITH base AS (${STOCK_SOURCE_SQL}), active AS (
    SELECT item_id,warehouse_id,name,code,photo_file_id,warehouse_name,unit_name,quantity,minimum_stock,condition
    FROM base WHERE is_active AND has_history
  ), attention AS (
    SELECT item_id::text,warehouse_id::text,name,code,photo_file_id,warehouse_name,unit_name,quantity,minimum_stock,condition
    FROM active WHERE condition IN ('low','empty')
    ORDER BY CASE WHEN condition='empty' THEN 0 ELSE 1 END,
      quantity::numeric/NULLIF(minimum_stock::numeric,0) NULLS FIRST,name,warehouse_id,item_id LIMIT 10
  ) SELECT (SELECT count(*)::int FROM active WHERE condition='low') AS low,
    (SELECT count(*)::int FROM active WHERE condition='empty') AS empty,
    (SELECT count(*)::int FROM active WHERE condition='sufficient') AS sufficient,
    COALESCE((SELECT jsonb_agg(attention) FROM attention),'[]'::jsonb) AS attention`, [org, scope, warehouseId, null, null, ""])).rows[0];
}

const transactionBase = `tx.organization_id=$1 AND ($2::bigint[] IS NULL OR tx.warehouse_id=ANY($2::bigint[]))
  AND ($3::bigint IS NULL OR tx.warehouse_id=$3) AND tx.status='posted' AND tx.kind<>'reversal'`;
const notCancelled = `NOT EXISTS(SELECT 1 FROM inventory_transactions reversal
  WHERE reversal.organization_id=tx.organization_id AND reversal.reversal_of_id=tx.id AND reversal.status='posted')`;

export async function readInventoryDashboardTransactions(org, scope, warehouseId, range, database = pool) {
  const identity = actorIdentitySql("account", "tx.organization_id");
  const [activity, recent] = await Promise.all([
    database.query(`SELECT tx.kind,to_char(tx.occurred_on,'YYYY-MM-DD') AS occurred_on,count(*)::int AS count
      FROM inventory_transactions tx WHERE ${transactionBase} AND ${notCancelled}
      AND tx.kind IN ('receipt','issue','return','stocktake') AND tx.occurred_on BETWEEN $4::date AND $5::date
      GROUP BY tx.kind,tx.occurred_on ORDER BY tx.occurred_on`, [org, scope, warehouseId, range.start, range.end]),
    database.query(`SELECT tx.id,tx.kind,to_char(tx.occurred_on,'YYYY-MM-DD') AS occurred_on,
      warehouse.name AS warehouse_name,${identity.name} AS actor_name,${identity.photo} AS actor_photo_file_id,
      ${identity.position} AS actor_position_name,NOT (${notCancelled}) AS cancelled,
      (SELECT count(*)::int FROM inventory_transaction_lines line WHERE line.organization_id=tx.organization_id AND line.transaction_id=tx.id) AS item_count
      FROM inventory_transactions tx JOIN inventory_warehouses warehouse ON warehouse.organization_id=tx.organization_id AND warehouse.id=tx.warehouse_id
      JOIN users account ON account.id=tx.created_by_user_id ${identity.joins}
      WHERE ${transactionBase} ORDER BY COALESCE((SELECT max(reversal.recorded_at) FROM inventory_transactions reversal
        WHERE reversal.organization_id=tx.organization_id AND reversal.reversal_of_id=tx.id),tx.recorded_at) DESC,tx.id DESC LIMIT 5`, [org, scope, warehouseId]),
  ]);
  return { activity: activity.rows, recent: recent.rows };
}

export async function readInventoryDashboardDrafts(org, scope, warehouseId, actorId, database = pool) {
  return (await database.query(`SELECT tx.id,tx.kind,warehouse.name AS warehouse_name,tx.updated_at
    FROM inventory_transactions tx LEFT JOIN inventory_warehouses warehouse ON warehouse.organization_id=tx.organization_id AND warehouse.id=tx.warehouse_id
    WHERE tx.organization_id=$1 AND tx.created_by_user_id=$4 AND tx.status='draft'
      AND tx.draft_discarded_at IS NULL AND tx.draft_expires_at>now()
      AND (tx.warehouse_id IS NULL OR $2::bigint[] IS NULL OR tx.warehouse_id=ANY($2::bigint[]))
      AND ($3::bigint IS NULL OR tx.warehouse_id=$3) ORDER BY tx.updated_at DESC,tx.id DESC LIMIT 3`, [org, scope, warehouseId, actorId])).rows;
}

/** Pembatalan mengikuti tanggal akhir periode seperti laporan Distribusi Barang. */
export async function readInventoryDashboardDistribution(org, scope, warehouseId, range, database = pool) {
  return (await database.query(`WITH issues AS (
    SELECT tx.id,tx.destination_location_id FROM inventory_transactions tx
    WHERE ${transactionBase} AND tx.kind='issue' AND tx.occurred_on BETWEEN $4::date AND $5::date
      AND NOT EXISTS(SELECT 1 FROM inventory_transactions reversal WHERE reversal.organization_id=tx.organization_id
        AND reversal.reversal_of_id=tx.id AND reversal.status='posted' AND reversal.occurred_on<=$5::date)
  ), destinations AS (
    SELECT COALESCE(location.name,'Tanpa lokasi') AS name,count(*)::int AS count FROM issues
    LEFT JOIN locations location ON location.organization_id=$1 AND location.id=issues.destination_location_id
    GROUP BY location.id,location.name ORDER BY count DESC,name,location.id LIMIT 5
  ) SELECT (SELECT count(*)::int FROM issues) AS total,
    COALESCE((SELECT jsonb_agg(destinations) FROM destinations),'[]'::jsonb) AS destinations`, [org, scope, warehouseId, range.start, range.end])).rows[0];
}
