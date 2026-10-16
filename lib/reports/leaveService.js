import { createHash } from "node:crypto";
import pool from "@/lib/dbConfig";
import { ServiceError } from "@/lib/api/routeHelpers";
import { normalizeLeaveReportFilters } from "./leavePolicy.mjs";
import { buildLeaveReportQuery } from "./leaveQuery.mjs";

export async function readLeaveReport(input, context, { exportAll = false } = {}) {
  let filters;
  try {
    filters = normalizeLeaveReportFilters(input, context.today);
  } catch (error) {
    throw new ServiceError("REPORT_FILTER_INVALID", error.message, 400, error.fieldErrors);
  }
  if (exportAll && filters.view !== "employees")
    throw new ServiceError(
      "REPORT_FILTER_INVALID",
      "Export hanya tersedia pada rekap pegawai.",
      400,
    );
  if (filters.locationId && context.scope && !context.scope.includes(filters.locationId))
    throw new ServiceError(
      "REPORT_LOCATION_FORBIDDEN",
      "Lokasi berada di luar cakupan akses Anda.",
      403,
    );
  const { cursor: encoded, ...stable } = filters;
  const signature = createHash("sha256")
    .update(JSON.stringify([stable, context.organizationId, context.scope, context.today]))
    .digest("hex");
  let cursor = null;
  if (encoded && !exportAll) {
    try {
      cursor = JSON.parse(Buffer.from(encoded, "base64url").toString());
      const keys = filters.view === "details" ? ["id"] : ["employeeId", "leaveTypeId"];
      if (
        cursor.signature !== signature ||
        keys.some((key) => !/^\d{1,19}$/.test(cursor[key] || ""))
      )
        throw new Error();
    } catch {
      throw new ServiceError(
        "REPORT_CURSOR_EXPIRED",
        "Filter laporan berubah. Muat ulang dari halaman pertama.",
        400,
      );
    }
  }
  const {
    rows: [result],
  } = await pool.query(
    buildLeaveReportQuery(
      filters,
      context,
      exportAll ? 5001 : filters.pageSize + 1,
      cursor,
      exportAll,
    ),
  );
  if (exportAll && (result.total > 5000 || result.detail_total > 5000))
    throw new ServiceError(
      "REPORT_EXPORT_LIMIT",
      "Rekap atau rincian melebihi 5.000 baris. Persempit filter sebelum mengunduh Excel.",
      400,
    );
  const hasMore = !exportAll && result.rows.length > filters.pageSize;
  const rows = hasMore ? result.rows.slice(0, filters.pageSize) : result.rows,
    last = rows.at(-1);
  return {
    ...result,
    rows,
    organization: {
      id: context.organization.id,
      name: context.organization.name,
      timezone: context.organization.timezone,
    },
    asOf: context.today,
    filters,
    nextCursor: hasMore
      ? Buffer.from(
          JSON.stringify({
            ...(filters.view === "details"
              ? { id: last.id }
              : { employeeId: last.employee_id, leaveTypeId: last.leave_type_id }),
            signature,
          }),
        ).toString("base64url")
      : null,
  };
}
