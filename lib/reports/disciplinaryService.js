import { createHash } from "node:crypto";
import pool from "@/lib/dbConfig";
import { ServiceError } from "@/lib/api/routeHelpers";
import { EXPORT_LIMIT } from "./policy.mjs";
import { buildDisciplinaryReportQuery } from "./disciplinaryQuery.mjs";
import { normalizeDisciplinaryReportFilters } from "./disciplinaryPolicy.mjs";

/** Membaca laporan sanksi dengan filter, scope, dan cursor yang terikat pada session. */
export async function readDisciplinaryReport(input, context, { exportAll = false } = {}) {
  let filters;
  try {
    filters = normalizeDisciplinaryReportFilters(input);
  } catch (error) {
    throw new ServiceError("REPORT_FILTER_INVALID", error.message, 400, error.fieldErrors);
  }
  if (filters.locationId && context.scope && !context.scope.includes(filters.locationId))
    throw new ServiceError(
      "REPORT_LOCATION_FORBIDDEN",
      "Lokasi berada di luar cakupan akses akun Anda.",
      403,
    );
  const { cursor: encoded, ...fingerprintFilters } = filters;
  const signature = createHash("sha256")
    .update(
      JSON.stringify([
        "disciplinary-actions",
        fingerprintFilters,
        context.organizationId,
        context.scope,
        context.today,
      ]),
    )
    .digest("hex");
  let cursor = null;
  if (encoded && !exportAll) {
    try {
      cursor = JSON.parse(Buffer.from(encoded, "base64url").toString());
      if (
        cursor.signature !== signature ||
        !/^\d{4}-\d{2}-\d{2}$/.test(cursor.date || "") ||
        !/^[1-9]\d{0,18}$/.test(cursor.employeeId || "")
      )
        throw new Error();
    } catch {
      throw new ServiceError(
        "REPORT_CURSOR_EXPIRED",
        "Halaman laporan sudah berubah. Muat ulang dari halaman pertama.",
        400,
      );
    }
  }
  const limit = exportAll ? EXPORT_LIMIT + 1 : filters.pageSize + 1;
  const {
    rows: [result],
  } = await pool.query(
    buildDisciplinaryReportQuery(
      filters,
      context.organizationId,
      context.scope,
      context.today,
      limit,
      cursor,
    ),
  );
  if (exportAll && result.total > EXPORT_LIMIT)
    throw new ServiceError(
      "REPORT_EXPORT_LIMIT",
      "Hasil melebihi 5.000 pegawai. Persempit filter sebelum mengunduh Excel.",
      400,
    );
  const hasMore = !exportAll && result.rows.length > filters.pageSize;
  const rows = hasMore ? result.rows.slice(0, filters.pageSize) : result.rows;
  const last = rows.at(-1);
  return {
    rows,
    total: result.total,
    employeeCount: result.total,
    totalMatchedActions: result.total_matched_actions,
    totalActiveOrAppealed: result.total_active_or_appealed,
    organization: context.organization,
    filters,
    asOf: context.today,
    generatedAt: new Date().toISOString(),
    nextCursor:
      hasMore && last
        ? Buffer.from(
            JSON.stringify({
              date: last.latest_issued_date,
              employeeId: last.employee_id,
              signature,
            }),
          ).toString("base64url")
        : null,
  };
}
