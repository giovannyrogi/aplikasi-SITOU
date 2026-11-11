import { createHash } from "node:crypto";
import pool from "@/lib/dbConfig";
import { ServiceError } from "@/lib/api/routeHelpers";
import { hrisLevel } from "@/lib/access/hrisPolicy.mjs";
import { requireAttendanceModule } from "@/lib/access/organizationModuleAccess";
import { getStoredFile } from "@/lib/files/storage";
import { getReportContext } from "./service";
import { validReportId, validDate, EXPORT_LIMIT } from "./policy.mjs";
import { normalizeAttendanceFilters } from "./attendancePolicy.mjs";
import { buildAttendanceQuery } from "./attendanceQuery.mjs";

export async function getAttendanceReportContext(actor, requestedOrganizationId) {
  if (
    !["hrd", "superadmin"].includes(actor.role_code) ||
    !hrisLevel(actor, "attendance-summary-report")
  )
    throw new ServiceError(
      "REPORT_FORBIDDEN",
      "Akun Anda belum memiliki akses Rekap Absensi.",
      403,
    );
  const context = await getReportContext(actor, requestedOrganizationId);
  await requireAttendanceModule(pool, context.organizationId);
  return context;
}

export async function readAttendanceOptions(context) {
  const {
    rows: [options],
  } = await pool.query(
    `SELECT
      (SELECT json_agg(json_build_object('value',id::text,'label',name) ORDER BY name,id)
        FROM locations WHERE organization_id=$1 AND ($2::bigint[] IS NULL OR id=ANY($2))) AS locations,
      (SELECT json_agg(json_build_object('value',id::text,'label',name) ORDER BY name,id)
        FROM organization_units WHERE organization_id=$1) AS units,
      (SELECT json_agg(json_build_object('value',id::text,'label',name) ORDER BY name,id)
        FROM positions WHERE organization_id=$1) AS positions,
      (SELECT json_agg(json_build_object('value',id::text,'label',name) ORDER BY name,id)
        FROM employment_types WHERE organization_id=$1) AS "employmentTypes"`,
    [context.organizationId, context.scope],
  );
  return { ...options, today: context.today };
}

export async function readAttendanceReport(
  input,
  context,
  exportAll = false,
  canViewPhotos = false,
) {
  const { filters, fieldErrors } = normalizeAttendanceFilters(input, context.today);
  if (fieldErrors)
    throw new ServiceError(
      "REPORT_FILTER_INVALID",
      Object.values(fieldErrors)[0],
      400,
      fieldErrors,
    );
  if (filters.locationId && context.scope && !context.scope.includes(filters.locationId))
    throw new ServiceError(
      "REPORT_LOCATION_FORBIDDEN",
      "Lokasi berada di luar cakupan akses Anda.",
      403,
    );

  const { cursor: encoded, ...stable } = filters;
  const signature = createHash("sha256")
    .update(JSON.stringify([stable, context.organizationId, context.scope]))
    .digest("hex");
  let cursor;
  if (encoded && !exportAll) {
    try {
      cursor = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
      if (
        cursor.signature !== signature ||
        !validReportId(cursor.id) ||
        !validDate(cursor.workDate)
      )
        throw new Error();
    } catch {
      throw new ServiceError(
        "REPORT_CURSOR_EXPIRED",
        "Filter laporan berubah. Atur ulang filter.",
        400,
      );
    }
  }
  const limit = exportAll ? EXPORT_LIMIT : filters.pageSize;
  const {
    rows: [result],
  } = await pool.query(
    buildAttendanceQuery(context, filters, {
      limit: limit + 1,
      cursor,
    }),
  );
  if (exportAll && result.total > EXPORT_LIMIT)
    throw new ServiceError(
      "REPORT_EXPORT_LIMIT",
      "Hasil melebihi 5.000 baris. Persempit filter sebelum mengunduh Excel.",
      400,
    );
  const rows = result.rows.slice(0, limit);
  const last = rows.at(-1);
  return {
    total: result.total,
    rows: rows.map(({ daily_schedule_id, employee_id, profile_photo_file_id, ...row }) => ({
      ...row,
      profile_photo_file_id: canViewPhotos ? profile_photo_file_id : null,
    })),
    nextCursor:
      result.rows.length > limit
        ? Buffer.from(
            JSON.stringify({ id: last.id, workDate: last.work_date, signature }),
          ).toString("base64url")
        : null,
    organization: context.organization.name,
    timezone: context.organization.timezone,
    filters: stable,
  };
}

async function getSummary(context, summaryId) {
  if (!validReportId(summaryId))
    throw new ServiceError("REPORT_FILTER_INVALID", "Rincian absensi tidak valid.", 400);
  const {
    rows: [result],
  } = await pool.query(buildAttendanceQuery(context, null, { summaryId }));
  const row = result.rows[0];
  if (!row) throw new ServiceError("REPORT_ROW_NOT_FOUND", "Rincian absensi tidak tersedia.", 404);
  return row;
}

export async function readAttendanceDetails(context, summaryId, canViewPhotos) {
  const { employee_id, daily_schedule_id, profile_photo_file_id, ...row } = await getSummary(
    context,
    summaryId,
  );
  const parameters = [context.organizationId, employee_id, daily_schedule_id];
  const events = await pool.query(
    `SELECT ev.id::text,ev.event_date::text,ev.event_type,ev.occurred_at,ev.timing_category,
        ev.assessment_version,ev.schedule_reference_at,ev.early_arrival_minutes,ev.late_minutes,
        ev.early_leave_minutes,ev.late_departure_minutes,ev.work_context,
        ev.geofence_status,ev.point_name_snapshot,ev.distance_from_point_m,ev.attendance_note,
        ev.organization_timezone_snapshot,
        ev.validation_details #>> '{result,nearRadiusBoundary}'='true' AS near_boundary,
        CASE WHEN $4 THEN ev.photo_file_id IS NOT NULL END AS has_photo_reference,
        CASE WHEN $4 AND file.id IS NOT NULL THEN file.id::text END AS photo_id
      FROM attendance_events ev
      LEFT JOIN stored_files file ON $4 AND file.organization_id=ev.organization_id
        AND file.id=ev.photo_file_id AND file.employee_id=ev.employee_id
        AND file.category='attendance_photo' AND file.deleted_at IS NULL
      WHERE ev.organization_id=$1 AND ev.employee_id=$2 AND ev.daily_schedule_id=$3
        AND ev.validation_status='valid' AND ev.event_type IN ('check_in','check_out')
      ORDER BY ev.occurred_at,ev.event_date,ev.id`,
    [...parameters, canViewPhotos],
  );
  return {
    row,
    events: events.rows,
    timezone: context.organization.timezone,
    canViewPhotos,
  };
}

export async function readAttendancePhoto(context, summaryId, fileId) {
  if (!validReportId(fileId))
    throw new ServiceError("REPORT_FILTER_INVALID", "Foto absensi tidak valid.", 400);
  const row = await getSummary(context, summaryId);
  if (fileId === row.profile_photo_file_id) {
    const file = await getStoredFile(fileId, context.organizationId);
    if (file.category === "employee_photo" && file.employee_id === row.employee_id) return file;
    throw new ServiceError("FILE_NOT_FOUND", "Foto Pegawai tidak tersedia.", 404);
  }
  const { rowCount } = await pool.query(
    `SELECT 1 FROM attendance_events WHERE organization_id=$1 AND employee_id=$2
      AND daily_schedule_id=$3 AND photo_file_id=$4 AND validation_status='valid'
      AND event_type IN ('check_in','check_out') LIMIT 1`,
    [context.organizationId, row.employee_id, row.daily_schedule_id, fileId],
  );
  if (!rowCount) throw new ServiceError("FILE_NOT_FOUND", "Foto absensi tidak tersedia.", 404);
  const file = await getStoredFile(fileId, context.organizationId);
  if (file.category !== "attendance_photo" || file.employee_id !== row.employee_id)
    throw new ServiceError("FILE_NOT_FOUND", "Foto absensi tidak tersedia.", 404);
  return file;
}
