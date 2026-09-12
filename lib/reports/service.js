import pool from "@/lib/dbConfig";
import { getActorLocationScope, resolvePermissionOrganization } from "@/lib/auth/permissions";
import { ServiceError } from "@/lib/api/routeHelpers";
import { calculateEmployeeTenure } from "@/lib/employees/tenure";
import { buildReportQuery } from "./query.mjs";
import {
  normalizeReportFilters,
  organizationToday,
  EXPORT_LIMIT,
  deadlineLabel,
  validDate,
  validReportId,
} from "./policy.mjs";
import { createHash } from "node:crypto";

/** Context selalu diambil dari session dan timezone organisasi yang tervalidasi. */
export async function getReportContext(actor, requestedOrganizationId) {
  if (!["superadmin", "hrd", "leader"].includes(actor.role_code))
    throw new ServiceError(
      "REPORT_FORBIDDEN",
      "Akun Anda tidak memiliki akses laporan organisasi.",
      403,
    );
  const organizationId = resolvePermissionOrganization(actor, requestedOrganizationId);
  if (!validReportId(organizationId))
    throw new ServiceError("REPORT_FILTER_INVALID", "Pilih organisasi yang valid.", 400, {
      organizationId: "Pilih organisasi yang valid.",
    });
  const permissions = await pool.query(
    `SELECT p.code FROM permissions p JOIN role_permissions rp ON rp.permission_id=p.id
    JOIN roles r ON r.id=rp.role_id WHERE r.code=$1 AND p.code IN ('employees.read','contracts.read')`,
    [actor.role_code],
  );
  const permissionCodes = permissions.rows.map((row) => row.code);
  if (!permissionCodes.includes("employees.read"))
    throw new ServiceError(
      "REPORT_FORBIDDEN",
      "Akun Anda tidak memiliki izin membaca laporan pegawai.",
      403,
    );
  const result = await pool.query(
    "SELECT id::text,name,timezone FROM organizations WHERE id=$1 AND is_active=true",
    [organizationId],
  );
  if (!result.rows[0])
    throw new ServiceError("ORGANIZATION_NOT_FOUND", "Organisasi aktif tidak ditemukan.", 404);
  const scope = await getActorLocationScope(actor);
  // Scope selected tanpa membership tidak boleh berubah menjadi akses seluruh lokasi.
  if (
    actor.role_code === "hrd" &&
    actor.location_scope_mode === "selected" &&
    !actor.role_assignment_id
  )
    throw new ServiceError(
      "REPORT_SCOPE_INVALID",
      "Cakupan akun belum lengkap. Hubungi Admin organisasi.",
      403,
    );
  return {
    organization: result.rows[0],
    organizationId,
    scope,
    permissionCodes,
    today: organizationToday(result.rows[0].timezone),
  };
}

/** Keyset pagination diikat ke filter dan tanggal acuan agar cursor lama tidak mengacaukan hasil. */
export async function readReport(
  kind,
  input,
  context,
  { exportAll = false, summaryOnly = false } = {},
) {
  if (kind === "expiring-contracts" && !context.permissionCodes.includes("contracts.read"))
    throw new ServiceError(
      "REPORT_FORBIDDEN",
      "Akun Anda tidak memiliki izin membaca laporan kontrak.",
      403,
    );
  let filters;
  try {
    filters = normalizeReportFilters(kind, input, context.today);
  } catch (error) {
    throw new ServiceError("REPORT_FILTER_INVALID", error.message, 400, error.fieldErrors);
  }
  const { cursor: encoded, ...fingerprintFilters } = filters;
  if (filters.locationId && context.scope && !context.scope.includes(filters.locationId))
    throw new ServiceError(
      "REPORT_LOCATION_FORBIDDEN",
      "Lokasi berada di luar cakupan akses akun Anda.",
      403,
    );
  const signature = createHash("sha256")
    .update(
      JSON.stringify([
        kind,
        fingerprintFilters,
        context.organizationId,
        context.scope,
        context.today,
      ]),
    )
    .digest("hex");
  let cursor = null;
  if (encoded && !exportAll && !summaryOnly) {
    try {
      cursor = JSON.parse(Buffer.from(encoded, "base64url").toString());
      if (cursor.signature !== signature || !validDate(cursor.date) || !validReportId(cursor.id))
        throw new Error();
    } catch {
      throw new ServiceError(
        "REPORT_CURSOR_EXPIRED",
        "Halaman laporan sudah berubah. Muat ulang dari halaman pertama.",
        400,
      );
    }
  }
  const limit = summaryOnly ? 0 : exportAll ? EXPORT_LIMIT + 1 : filters.pageSize + 1;
  const query = buildReportQuery(
    kind,
    filters,
    context.organizationId,
    context.scope,
    context.today,
    limit,
    cursor,
  );
  const {
    rows: [result],
  } = await pool.query(query);
  if (exportAll && result.total > EXPORT_LIMIT)
    throw new ServiceError(
      "REPORT_EXPORT_LIMIT",
      "Hasil melebihi 5.000 baris. Persempit filter sebelum mengunduh Excel.",
      400,
    );
  const hasMore = !exportAll && result.rows.length > filters.pageSize;
  const rows = (hasMore ? result.rows.slice(0, filters.pageSize) : result.rows).map((row) => {
    const tenure = calculateEmployeeTenure({
      joinedDate: row.joined_date,
      employmentStatus: row.employment_status,
      today: context.today,
    });
    return {
      ...row,
      tenure: tenure.valid ? tenure.duration : tenure.message,
      deadline: deadlineLabel(row.days_remaining, kind),
    };
  });
  const last = rows.at(-1);
  return {
    rows,
    total: result.total,
    rowOffset: result.row_offset,
    employeeCount: result.employee_count,
    organization: context.organization,
    filters,
    asOf: context.today,
    generatedAt: new Date().toISOString(),
    nextCursor:
      hasMore && last
        ? Buffer.from(
            JSON.stringify({ date: last.due_date || "9999-12-31", id: last.id, signature }),
          ).toString("base64url")
        : null,
  };
}

/** Dashboard memakai query laporan yang sama dengan lima prioritas untuk tiap kelompok pensiun. */
export async function getReportDashboardMetrics(actor, organizationId) {
  const context = await getReportContext(actor, organizationId);
  const definitions = [
    ["expiring-contracts", {}, "expiringContracts", "Kontrak segera berakhir", "danger"],
    ["retirements", {}, "upcomingRetirements", "Mencapai usia pensiun dalam 12 bulan", "warning"],
    [
      "retirements",
      { group: "overdue" },
      "overdueRetirements",
      "Sudah mencapai usia pensiun, masih tercatat bekerja",
      "info",
    ],
  ];
  return Promise.all(
    definitions.map(async ([kind, input, key, label, tone]) => {
      const report = await readReport(kind, { ...input, pageSize: 5 }, context, {
        summaryOnly: kind !== "retirements",
      });
      const query = new URLSearchParams({
        organizationId,
        group: report.filters.group,
        period: report.filters.startDate ? "custom" : "none",
      });
      if (report.filters.startDate) {
        query.set("startDate", report.filters.startDate);
        query.set("endDate", report.filters.endDate);
      }
      return {
        key,
        label,
        tone,
        value: report.total,
        icon: "solar:calendar-date-bold-duotone",
        description: report.filters.startDate
          ? `${report.filters.startDate} s.d. ${report.filters.endDate}`
          : `Sebelum ${report.asOf}; hubungan kerja masih berjalan.`,
        href: `/reports/${kind}?${query}`,
        ...(kind === "retirements" ? { rows: report.rows, asOf: report.asOf } : {}),
      };
    }),
  );
}
