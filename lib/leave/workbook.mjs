import ExcelJS from "exceljs";
import { LEAVE_CATEGORY, LEAVE_STATUS, LEAVE_UNIT, formatLeaveDate } from "./labels.mjs";

const text = (value) => {
  if (value === null || value === undefined || value === "") return "—";
  const result = String(value);
  return /^[=+\-@]/.test(result) ? `'${result}` : result;
};

/** Ringkasan tanpa alasan pribadi, data medis, maupun lampiran privat. */
export async function buildLeaveWorkbook({ rows, organization, filters, asOf }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SITOU";
  const sheet = workbook.addWorksheet("Cuti dan Izin");
  sheet.addRow(["Cuti & Izin"]);
  sheet.addRow(["Organisasi", text(organization.name)]);
  sheet.addRow(["Tanggal ekspor", asOf]);
  sheet.addRow(["Rentang tanggal", filters.startDate || "Semua tanggal", filters.endDate || ""]);
  sheet.addRow(["Status", LEAVE_STATUS[filters.requestStatus]?.[0] || "Semua status"]);
  sheet.addRow([
    "Keterangan",
    "Seluruh hasil sesuai filter dan cakupan akses, termasuk periode yang beririsan.",
  ]);
  sheet.addRow([]);
  const columns = [
    ["request_no", "Nomor cuti/izin", 24],
    ["employee_no", "NIP", 24],
    ["full_name", "Nama pegawai", 34],
    ["leave_type_name", "Jenis cuti/izin", 28],
    ["category_label", "Kategori", 18],
    ["start_label", "Tanggal mulai", 20],
    ["end_label", "Tanggal akhir", 20],
    ["requested_units", "Durasi", 14],
    ["unit_label", "Satuan", 12],
    ["location_name", "Lokasi", 30],
    ["organization_unit_name", "Divisi & Unit", 34],
    ["position_name", "Jabatan", 28],
    ["status_label", "Status", 18],
  ];
  const header = sheet.addRow(columns.map(([, label]) => label));
  header.font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: header.number }];
  sheet.autoFilter = {
    from: { row: header.number, column: 1 },
    to: { row: header.number, column: columns.length },
  };
  for (const raw of rows) {
    const row = {
      ...raw,
      category_label: LEAVE_CATEGORY[raw.category]?.[0],
      status_label: LEAVE_STATUS[raw.status]?.[0],
      unit_label: LEAVE_UNIT[raw.unit],
      start_label: formatLeaveDate(raw.start_date),
      end_label: formatLeaveDate(raw.end_date),
    };
    sheet.addRow(
      columns.map(([key]) => (key === "requested_units" ? Number(row[key]) : text(row[key]))),
    );
  }
  columns.forEach(([key, , width], index) => {
    const column = sheet.getColumn(index + 1);
    column.width = width;
    column.numFmt = key === "requested_units" ? "0" : "@";
  });
  return workbook.xlsx.writeBuffer();
}
