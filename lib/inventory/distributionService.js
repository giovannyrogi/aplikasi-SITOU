import { distributionItemOptions } from "./distributionOptions.mjs";
import { z } from "zod";
import { createHash } from "node:crypto";
import pool from "@/lib/dbConfig";
import { ServiceError } from "@/lib/api/routeHelpers";
import { requireInventoryAccess } from "./service";
import { readPermissionScope } from "@/lib/access/packageRepository";
import { hasScope } from "@/lib/access/packagePolicy.mjs";
import {
  readDistribution,
  readDistributionTotals,
  readDistributionOptions,
} from "./distributionRepository";
export const DISTRIBUTION_EXPORT_LIMIT = 5000;
/** Scope, periode, total dan baris dibaca pada snapshot yang sama tanpa mengubah stok. */
export async function distributionReport(
  input,
  actor,
  { options = false, exportAll = false } = {},
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const scope = await requireInventoryAccess(
      actor,
      input.organizationId,
      "inventory.reports.read",
      input.warehouseId,
      client,
    );
    const organization = (
      await client.query(
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
        { to: "Pilih tanggal akhir pada atau setelah tanggal awal." },
      );
    const { cursor, ...filters } = resolved;
    const fingerprint = createHash("sha256")
      .update(JSON.stringify({ filters, scope: scope === null ? null : [...scope].sort() }))
      .digest("hex");
    let after = null;
    if (cursor && !exportAll)
      try {
        const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString());
        if (decoded.fingerprint !== fingerprint || !Array.isArray(decoded.after)) throw Error();
        after = decoded.after;
        if (
          after.length !== 3 ||
          !z.iso.date().safeParse(after[0]).success ||
          !z.uuid().safeParse(after[1]).success ||
          !/^\d{1,18}$/.test(after[2])
        )
          throw Error();
      } catch {
        throw new ServiceError(
          "CURSOR_INVALID",
          "Halaman laporan tidak berlaku. Muat ulang hasil.",
          400,
          { cursor: "Muat ulang laporan." },
        );
      }
    let result;
    if (options) {
      const rows = await readDistributionOptions(client, input.organizationId, scope);
      const choices = (id, name) =>
        [
          ...new Map(
            rows
              .filter((r) => r[id])
              .map((r) => [r[id], { value: r[id], label: r[name] || "Tidak tersedia" }]),
          ).values(),
        ].sort((a, b) => a.label.localeCompare(b.label, "id-ID"));
      result = {
        today: organization.today,
        from: resolved.from,
        to: resolved.to,
        warehouses: choices("warehouse_id", "warehouse_name"),
        items: distributionItemOptions(rows),
        locations: choices("location_id", "location_name"),
        units: choices("unit_id", "destination_unit_name"),
        recipients: choices("recipient_id", "recipient_name"),
      };
    } else {
      const totals = await readDistributionTotals(client, resolved, scope);
      const total = totals.detail_count;
      if (exportAll && total > DISTRIBUTION_EXPORT_LIMIT)
        throw new ServiceError(
          "EXPORT_LIMIT_EXCEEDED",
          `Hasil laporan berisi ${total} baris. Ekspor maksimal ${DISTRIBUTION_EXPORT_LIMIT} baris; persempit periode atau filter.`,
          400,
          { from: "Persempit periode atau filter sebelum mengekspor." },
        );
      const rows = await readDistribution(
        client,
        resolved,
        scope,
        after,
        exportAll ? DISTRIBUTION_EXPORT_LIMIT : resolved.pageSize + 1,
      );
      const transactionScope = await readPermissionScope(
        actor,
        input.organizationId,
        "inventory.transactions.read",
        client,
      );
      const data = (exportAll ? rows : rows.slice(0, resolved.pageSize)).map((r) => ({
        ...r,
        canReadTransaction: hasScope(transactionScope, r.warehouse_id),
      }));
      const last = data.at(-1);
      const key = last && [last.occurred_on, last.transaction_id, last.id];
      result = {
        data,
        total,
        pageSize: resolved.pageSize,
        filters,
        organization,
        generatedAt: new Date().toISOString(),
        nextCursor:
          !exportAll && rows.length > resolved.pageSize
            ? Buffer.from(JSON.stringify({ fingerprint, after: key })).toString("base64url")
            : null,
      };
    }
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
