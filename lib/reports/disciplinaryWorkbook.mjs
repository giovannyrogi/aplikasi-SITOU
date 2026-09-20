import ExcelJS from "exceljs";
import { DISCIPLINARY_REPORT_TITLE } from "./disciplinaryPolicy.mjs";

export const disciplinaryReportColumns = [
  ["employee_no", "NIP"],
  ["full_name", "Nama pegawai"],
  ["employment_status_label", "Status pegawai"],
  ["location_name", "Lokasi"],
  ["unit_name", "Divisi & Unit"],
  ["position_name", "Jabatan"],
  ["case_no", "Nomor kasus"],
  ["severity_label", "Tingkat pelanggaran"],
  ["action_type_label", "Jenis sanksi terbaru sesuai filter"],
  ["action_status_label", "Status tindakan"],
  ["letter_no", "Nomor surat"],
  ["incident_date", "Tanggal kejadian"],
  ["issued_date", "Tanggal terbit"],
  ["effective_from", "Mulai berlaku"],
  ["effective_until", "Akhir berlaku"],
  ["issued_by_name", "Diterbitkan oleh"],
  ["direct_escalation_label", "Eskalasi langsung"],
  ["matched_action_count", "Tindakan cocok"],
  ["total_official_actions", "Total tindakan resmi"],
  ["active_or_appealed_count", "Aktif / dalam banding"],
];

const STATUS_LABELS = {
  active: "Aktif",
  expired: "Berakhir",
  revoked: "Dicabut",
  appealed: "Dalam banding",
  superseded: "Digantikan",
};
const SEVERITY_LABELS = { light: "Ringan", moderate: "Sedang", severe: "Berat" };
const EMPLOYMENT_LABELS = {
  active: "Aktif",
  probation: "Masa percobaan",
  suspended: "Ditangguhkan",
  draft: "Draft",
  terminated: "Diberhentikan",
  retired: "Pensiun",
  deceased: "Meninggal dunia",
};

function safeText(value, fallback = "—") {
  if (value === null || value === undefined || value === "") return fallback;
  const text = String(value);
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function exportRow(row) {
  return {
    ...row,
    employment_status_label: EMPLOYMENT_LABELS[row.employment_status] || row.employment_status,
    severity_label: SEVERITY_LABELS[row.severity] || row.severity,
    action_type_label: row.action_name_snapshot,
    action_status_label: STATUS_LABELS[row.action_status] || row.action_status,
    direct_escalation_label: row.direct_escalation ? "Ya" : "Tidak",
  };
}

/** Workbook hanya membawa fakta ringkas; narasi sensitif dan URL file tidak pernah diekspor. */
export async function buildDisciplinaryReportWorkbook(report) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SITOU";
  const sheet = workbook.addWorksheet("Laporan");
  sheet.addRow([DISCIPLINARY_REPORT_TITLE]);
  sheet.addRow(["Organisasi", safeText(report.organization.name)]);
  sheet.addRow(["Tanggal acuan", report.asOf]);
  sheet.addRow(["Waktu ekspor (UTC)", report.generatedAt]);
  sheet.addRow([
    "Rentang tanggal terbit",
    report.filters.startDate || "Semua histori",
    report.filters.endDate || "",
  ]);
  sheet.addRow(["Pencarian", safeText(report.filters.search, "Semua pegawai")]);
  for (const [key, label] of [
    ["locationId", "Lokasi"],
    ["organizationUnitId", "Divisi & Unit"],
    ["positionId", "Jabatan"],
  ])
    sheet.addRow([label, safeText(report.filterLabels?.[key], "Semua")]);
  sheet.addRow(["Status pegawai", report.filters.employmentStatus]);
  sheet.addRow(["Tingkat pelanggaran", report.filters.severity]);
  sheet.addRow(["Jenis sanksi", safeText(report.filterLabels?.actionTypeId, "Semua")]);
  sheet.addRow(["Status tindakan", report.filters.actionStatus]);
  sheet.addRow(["Jumlah pegawai", report.total, "Tindakan cocok", report.totalMatchedActions]);
  sheet.addRow([]);
  const header = sheet.addRow(disciplinaryReportColumns.map(([, label]) => label));
  header.font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: header.number }];
  sheet.autoFilter = {
    from: { row: header.number, column: 1 },
    to: { row: header.number, column: disciplinaryReportColumns.length },
  };
  for (const raw of report.rows) {
    const row = exportRow(raw);
    sheet.addRow(disciplinaryReportColumns.map(([key]) => safeText(row[key])));
  }
  disciplinaryReportColumns.forEach(([key], index) => {
    sheet.getColumn(index + 1).width = ["full_name", "issued_by_name"].includes(key) ? 34 : 24;
    if (["employee_no", "case_no", "letter_no"].includes(key))
      sheet.getColumn(index + 1).numFmt = "@";
  });
  return workbook.xlsx.writeBuffer();
}
