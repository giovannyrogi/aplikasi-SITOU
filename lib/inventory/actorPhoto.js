import pool from "@/lib/dbConfig";
import { ServiceError } from "@/lib/api/routeHelpers";
import { requireInventoryAccess } from "./service";
import { z } from "zod";

/** Hanya pas foto pelaku dokumen, tanpa membuka akses profil HRIS lain. */
export async function authorizeInventoryActorPhoto(user, file, params) {
  const id = params.get("inventoryActorTransactionId");
  const role = params.get("inventoryActorRole") || "creator";
  const view = params.get("inventoryActorView") || "transaction";
  const permission = { transaction: "inventory.transactions.read", stock: "inventory.stock.read", distribution: "inventory.reports.read" }[view];
  if (!permission || !["creator", "cancelled"].includes(role) || !z.uuid().safeParse(id).success)
    throw new ServiceError("FILE_FORBIDDEN", "Pas foto tidak terkait dokumen yang dapat Anda lihat.", 403);
  const result = await pool.query(`SELECT tx.warehouse_id::text
    FROM inventory_transactions tx
    LEFT JOIN inventory_transactions cancellation ON cancellation.organization_id=tx.organization_id AND cancellation.reversal_of_id=tx.id AND cancellation.status='posted'
    JOIN employees profile ON profile.organization_id=tx.organization_id AND profile.user_id=CASE WHEN $4='cancelled' THEN cancellation.created_by_user_id ELSE tx.created_by_user_id END
      AND profile.deleted_at IS NULL AND profile.profile_photo_file_id=$3 AND profile.id=$6
    WHERE tx.organization_id=$1 AND tx.id=$2::uuid AND tx.status='posted'
      AND ($5<>'distribution' OR tx.kind='issue')
      AND ($5<>'stock' OR EXISTS(SELECT 1 FROM inventory_stock_movements movement WHERE movement.organization_id=tx.organization_id AND movement.transaction_id=tx.id))`,
  [file.organization_id, id, file.id, role, view, file.employee_id]);
  if (!result.rowCount) throw new ServiceError("FILE_FORBIDDEN", "Pas foto tidak terkait dokumen yang dapat Anda lihat.", 403);
  await requireInventoryAccess(user, file.organization_id, permission, result.rows[0].warehouse_id);
}
