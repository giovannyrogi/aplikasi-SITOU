import ExcelJS from "exceljs";
import pool from "@/lib/dbConfig";
import { writeAudit } from "@/lib/audit";
import { requireAuthenticatedUser } from "@/app/utils/auth";
import { actorHasPermission } from "@/lib/auth/permissions";
import {
  getRequestId,
  handleRouteError,
  ServiceError,
  successResponse,
  validateMutationRequest,
} from "@/lib/api/routeHelpers";
import {
  assertStoredFileAvailable,
  createStoredFileStream,
  sanitizeDownloadName,
} from "@/lib/files/storage";
import {
  getAttendanceReportContext,
  readAttendanceReport,
  readAttendanceOptions,
  readAttendanceDetails,
  readAttendancePhoto,
} from "./attendanceService";
import {
  attendanceIndicatorLabel,
  attendanceRowIndicators,
  attendanceSchedule,
  ATTENDANCE_STATUS,
  attendanceTime,
} from "./attendancePresentation.mjs";

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};

async function attendanceWorkbook(report) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SITOU";
  const sheet = workbook.addWorksheet("Rekap Absensi");
  sheet.addRow(["Rekap Absensi", report.organization]);
  sheet.addRow(["Periode", report.filters.startDate, report.filters.endDate]);
  sheet.addRow(["Zona waktu", report.timezone]);
  const labels = [
    "Tanggal Absen",
    "Nama Pegawai",
    "NIP",
    "Lokasi",
    "Divisi & Unit",
    "Jabatan",
    "Jenis kepegawaian",
    "Jadwal Kerja",
    "Absen masuk pertama",
    "Absen pulang terakhir",
    "Durasi bersih (menit)",
    "Status",
    "Indikator",
  ];
  const header = sheet.addRow(labels);
  header.font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: header.number }];
  sheet.autoFilter = {
    from: { row: header.number, column: 1 },
    to: { row: header.number, column: labels.length },
  };
  sheet.getColumn(3).numFmt = "@";
  labels.forEach((label, index) => {
    sheet.getColumn(index + 1).width = Math.max(18, label.length + 5);
  });
  for (const row of report.rows) {
    sheet.addRow([
      row.work_date,
      row.full_name,
      row.employee_no || "",
      row.location_name,
      row.organization_unit_name,
      row.position_name,
      row.employment_type_name,
      attendanceSchedule(row, report.timezone).join(", ") || row.holiday_name || "",
      attendanceTime(row.first_check_in, report.timezone, row.work_date),
      attendanceTime(row.last_check_out, report.timezone, row.work_date),
      row.duration_complete ? row.worked_minutes : null,
      ATTENDANCE_STATUS[row.attendance_status]?.[0],
      attendanceRowIndicators(row)
        .map((key) => attendanceIndicatorLabel(key, row.late_minutes))
        .filter(Boolean)
        .join(", "),
    ]);
  }
  return workbook.xlsx.writeBuffer();
}

export async function handleAttendanceReport(request, mode = "list", routeParams) {
  const requestId = getRequestId(request);
  try {
    const { user, response } = await requireAuthenticatedUser();
    if (response) return response;
    const input = Object.fromEntries(new URL(request.url).searchParams);
    const context = await getAttendanceReportContext(user, input.organizationId);
    const { summaryId, fileId } = (await routeParams) || {};
    if (mode === "options") return successResponse(await readAttendanceOptions(context));
    if (mode === "details" || mode === "photo") {
      const canViewPhotos = await actorHasPermission(user, "private_files.read_sensitive");
      if (mode === "details") {
        const details = await readAttendanceDetails(context, summaryId, canViewPhotos);
        if (
          details.events.some((event) => event.latitude != null || event.point_latitude != null)
        ) {
          await writeAudit(pool, {
            organizationId: context.organizationId,
            actorUserId: user.id,
            action: "attendance_report.location_view",
            entityType: "attendance_daily_summary",
            entityId: summaryId,
            requestId,
          });
        }
        return successResponse(details);
      }
      if (!canViewPhotos)
        throw new ServiceError(
          "FILE_FORBIDDEN",
          "Akun Anda tidak memiliki izin melihat foto absensi.",
          403,
        );
      const file = await readAttendancePhoto(context, summaryId, fileId);
      await assertStoredFileAvailable(file);
      await writeAudit(pool, {
        organizationId: context.organizationId,
        actorUserId: user.id,
        action: "private_file.preview",
        entityType: "stored_file",
        entityId: file.id,
        afterData: { summaryId, category: file.category },
        requestId,
      });
      return new Response(createStoredFileStream(file), {
        headers: {
          ...PRIVATE_HEADERS,
          "Content-Type": file.mime_type,
          "Content-Length": String(file.size_bytes),
          "Content-Disposition": `inline; filename="${sanitizeDownloadName(file.original_name)}"`,
          "Content-Security-Policy": "default-src 'none'; sandbox",
        },
      });
    }
    if (mode === "list") {
      const canViewPhotos = await actorHasPermission(user, "private_files.read_sensitive");
      return successResponse(await readAttendanceReport(input, context, false, canViewPhotos));
    }
    const denied = await validateMutationRequest(request, user.id, requestId);
    if (denied) return denied;
    const report = await readAttendanceReport(input, context, true);
    const buffer = await attendanceWorkbook(report);
    await writeAudit(pool, {
      organizationId: context.organizationId,
      actorUserId: user.id,
      action: "report.export",
      entityType: "report",
      entityId: "attendance-summary",
      afterData: {
        startDate: report.filters.startDate,
        endDate: report.filters.endDate,
        rows: report.total,
      },
      requestId,
    });
    return new Response(buffer, {
      headers: {
        ...PRIVATE_HEADERS,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="sitou-rekap-absensi-${report.filters.startDate}.xlsx"`,
      },
    });
  } catch (error) {
    return handleRouteError("reports.attendance-summary", error, requestId);
  }
}
