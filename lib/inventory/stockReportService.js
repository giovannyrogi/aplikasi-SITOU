import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import pool from "@/lib/dbConfig";
import { ServiceError } from "@/lib/api/routeHelpers";
import { requireInventoryAccess } from "./service";
import { readPermissionScope } from "@/lib/access/packageRepository";
import { hasScope } from "@/lib/access/packagePolicy.mjs";
import {
  readStockReport,
  stockReportOptions,
  readStockReportHistory,
} from "./stockReportRepository";
const sign = (body) =>
  createHmac("sha256", process.env.AUTH_SESSION_SECRET)
    .update(`stock-report:${body}`)
    .digest("base64url");
function cursorContext(input, actor, scope, detail) {
  const { cursor, ...filters } = input;
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        filters,
        user: actor.id,
        scope: scope === null ? null : [...scope].sort(),
        detail,
      }),
    )
    .digest("hex");
  let after = null;
  if (cursor)
    try {
      const [body, signature, extra] = cursor.split(".");
      const expected = sign(body);
      if (
        extra ||
        !signature ||
        signature.length !== expected.length ||
        !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
      )
        throw Error();
      const parsed = JSON.parse(Buffer.from(body, "base64url").toString());
      if (
        parsed.fingerprint !== fingerprint ||
        !Number.isFinite(parsed.expires) ||
        parsed.expires < Date.now()
      )
        throw Error();
      after = parsed.after;
      const ids = detail ? [after.id] : [after.warehouseId, after.itemId];
      if (
        ids.some((id) => !/^[1-9]\d{0,18}$/.test(id)) ||
        (detail && !/^\d{4}-\d{2}-\d{2}$/.test(after.date))
      )
        throw Error();
    } catch {
      throw new ServiceError(
        "CURSOR_INVALID",
        "Halaman laporan tidak berlaku. Muat ulang laporan.",
        400,
      );
    }
  return {
    after,
    encode(after) {
      const body = Buffer.from(
        JSON.stringify({ fingerprint, after, expires: Date.now() + 1800000 }),
      ).toString("base64url");
      return `${body}.${sign(body)}`;
    },
  };
}
export async function stockReport(
  input,
  actor,
  { options = false, detail = false, exportAll = false } = {},
) {
  const db = await pool.connect();
  try {
    await db.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const scope = await requireInventoryAccess(
      actor,
      input.organizationId,
      "inventory.reports.read",
      input.warehouseId,
      db,
    );
    let warehouseName = null;
    if (input.warehouseId) {
      const warehouse = (
        await db.query("SELECT name FROM inventory_warehouses WHERE organization_id=$1 AND id=$2", [
          input.organizationId,
          input.warehouseId,
        ])
      ).rows[0];
      if (!warehouse)
        throw new ServiceError(
          "INVENTORY_FORBIDDEN",
          "Gudang tidak tersedia dalam cakupan akses Anda.",
          403,
        );
      warehouseName = warehouse.name;
    }
    const organization = (
      await db.query(
        "SELECT code,name,timezone,to_char((now() AT TIME ZONE timezone)::date,'YYYY-MM-DD') AS today FROM organizations WHERE id=$1",
        [input.organizationId],
      )
    ).rows[0];
    const resolved = {
      ...input,
      from: input.from || `${organization.today.slice(0, 7)}-01`,
      to: input.to || organization.today,
    };
    if (resolved.from > resolved.to)
      throw new ServiceError(
        "REPORT_DATE_INVALID",
        "Tanggal akhir tidak boleh sebelum tanggal awal.",
        400,
      );
    let result;
    if (options) {
      const rows = await stockReportOptions(db, input.organizationId, scope);
      const choices = (key, label) =>
        [...new Map(rows.map((r) => [r[key], { value: r[key], label: label(r) }])).values()].sort(
          (a, b) => a.label.localeCompare(b.label, "id"),
        );
      result = {
        from: resolved.from,
        to: resolved.to,
        warehouses: choices("warehouse_id", (r) => r.warehouse_name),
        categories: choices("category_id", (r) => r.category_name),
        items: choices("item_id", (r) => `${r.name} · ${r.code} · ${r.unit_name}`),
      };
    } else {
      const context = cursorContext(resolved, actor, scope, detail);
      if (detail && (!input.warehouseId || !input.itemId))
        throw new ServiceError(
          "VALIDATION_ERROR",
          "Pilih barang dan gudang untuk melihat rincian stok.",
          400,
        );
      const aggregate = await readStockReport(
        db,
        {
          ...resolved,
          search: detail ? "" : resolved.search,
          categoryId: detail ? undefined : resolved.categoryId,
        },
        scope,
        detail ? null : context.after,
        exportAll ? 5001 : detail ? 1 : resolved.pageSize + 1,
      );
      if (exportAll && aggregate.total > 5000)
        throw new ServiceError(
          "EXPORT_LIMIT_EXCEEDED",
          "Ekspor maksimal 5.000 data. Persempit periode atau filter.",
          400,
        );
      if (detail) {
        const item = aggregate.rows[0];
        if (!item)
          throw new ServiceError(
            "NOT_FOUND",
            "Tidak ada riwayat stok barang pada periode ini.",
            404,
          );
        const history = await readStockReportHistory(db, resolved, context.after);
        const transactionScope = await readPermissionScope(
          actor,
          input.organizationId,
          "inventory.transactions.read",
          db,
        );
        const rows = history.rows.slice(0, resolved.pageSize).map((r) => ({
          id: r.id,
          occurred_on: r.occurred_on,
          delta: r.delta,
          balance: r.balance,
          kind: r.kind,
          reference_no: r.reference_no,
          transaction_id: hasScope(transactionScope, input.warehouseId)
            ? r.transaction_id
            : undefined,
        }));
        const last = rows.at(-1);
        result = {
          item,
          data: rows,
          total: history.total,
          nextCursor:
            history.rows.length > resolved.pageSize
              ? context.encode({ date: last.occurred_on, id: last.id })
              : null,
        };
      } else {
        const data = (exportAll ? aggregate.rows : aggregate.rows.slice(0, resolved.pageSize)).map(
          (r) => ({ ...r, id: `${r.warehouse_id}-${r.item_id}` }),
        );
        const last = data.at(-1);
        result = {
          data,
          total: aggregate.total,
          nextCursor:
            !exportAll && aggregate.rows.length > resolved.pageSize
              ? context.encode({ warehouseId: last.warehouse_id, itemId: last.item_id })
              : null,
        };
      }
      result = {
        ...result,
        organization,
        warehouseName,
        filters: resolved,
        generatedAt: new Date().toISOString(),
      };
    }
    await db.query("COMMIT");
    return result;
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    db.release();
  }
}
