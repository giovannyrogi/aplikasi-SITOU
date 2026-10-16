import ExcelJS from "exceljs";
import { LEAVE_STATUS, LEAVE_UNIT } from "../leave/labels.mjs";

const text = (value) =>
  value == null ? "—" : /^[=+\-@]/.test(String(value)) ? `'${value}` : String(value);
export async function buildLeaveReportWorkbook(report) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SITOU";
  const sheet = workbook.addWorksheet("Rekap pegawai");
  sheet.addRow(["Rekap Cuti & Izin", report.filters.year]);
  sheet.addRow(["Organisasi", text(report.organization.name)]);
  sheet.addRow(["Saldo dibaca pada", report.asOf]);
  sheet.addRow([
    "Dasar laporan",
    "Tahun tanggal mulai cuti/izin; penempatan saat ini. Durasi penuh, bukan hari kalender.",
  ]);
  sheet.addRow([
    "Saldo",
    "Hak termasuk carryover/koreksi; terpakai bersih setelah pengembalian. — berarti belum ada saldo.",
  ]);
  sheet.addRow([]);
  const columns = [
    ["employee_no", "NIP"],
    ["full_name", "Pegawai"],
    ["location_name", "Lokasi saat ini"],
    ["organization_unit_name", "Divisi & Unit saat ini"],
    ["leave_type_name", "Jenis cuti/izin"],
    ["approved", "Disetujui"],
    ["duration", "Durasi cuti/izin"],
    ["unitLabel", "Satuan"],
    ["cancelled", "Dibatalkan"],
    ["allocated", "Hak"],
    ["used", "Terpakai"],
    ["balance", "Sisa"],
  ];
  const group = sheet.addRow(
    columns.map(([, label], i) =>
      i < 9 ? label : i === 9 ? `Saldo ${report.filters.year}` : null,
    ),
  );
  const header = sheet.addRow(columns.map(([, label], i) => (i < 9 ? null : label)));
  for (let column = 1; column <= 9; column++)
    sheet.mergeCells(group.number, column, header.number, column);
  sheet.mergeCells(group.number, 10, group.number, 12);
  for (const row of [group, header]) {
    row.height = 26;
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { bold: true, color: { argb: "FF273142" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F6F8" } };
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      cell.border = { bottom: { style: "thin", color: { argb: "FFD9DFE7" } } };
    });
  }
  sheet.views = [{ state: "frozen", ySplit: header.number }];
  const numeric = ["approved", "duration", "cancelled", "allocated", "used", "balance"];
  for (const row of report.rows)
    sheet.addRow(
      columns.map(([key]) =>
        key === "unitLabel"
          ? LEAVE_UNIT[row.unit]
          : numeric.includes(key)
            ? (["allocated", "used", "balance"].includes(key) && !row.uses_balance) ||
              row[key] == null
              ? "—"
              : Number(row[key])
            : text(row[key]),
      ),
    );
  columns.forEach(([key], i) => {
    sheet.getColumn(i + 1).width = [
      "full_name",
      "organization_unit_name",
      "leave_type_name",
    ].includes(key)
      ? 32
      : 23;
    sheet.getColumn(i + 1).numFmt = numeric.includes(key) ? "0" : "@";
  });
  const types = workbook.addWorksheet("Rekap jenis");
  types.addRow(["Jenis", "Disetujui", "Dibatalkan", "Durasi cuti/izin", "Satuan"]);
  for (const row of report.types)
    types.addRow([
      text(row.name),
      row.approved,
      row.cancelled,
      Number(row.duration),
      LEAVE_UNIT[row.unit],
    ]);
  const months = workbook.addWorksheet("Rekap bulanan");
  months.addRow(["Bulan", "Disetujui", "Dibatalkan"]);
  for (const row of report.months)
    months.addRow([
      new Intl.DateTimeFormat("id-ID", { month: "long", timeZone: "UTC" }).format(
        new Date(Date.UTC(report.filters.year, row.month - 1, 1)),
      ),
      row.approved,
      row.cancelled,
    ]);
  for (const target of [types, months]) {
    target.getRow(1).font = { bold: true };
    target.columns.forEach((column, i) => {
      column.width = i ? 22 : 32;
      column.numFmt = i ? "0" : "@";
    });
  }
  const details = workbook.addWorksheet("Rincian cuti izin");
  details.addRow([
    "NIP",
    "Pegawai",
    "Lokasi saat ini",
    "Divisi & Unit saat ini",
    "Jenis cuti/izin",
    "Nomor cuti/izin",
    "Status",
    "Tanggal mulai",
    "Tanggal akhir",
    "Durasi cuti/izin",
    "Satuan",
  ]);
  for (const row of report.detail_rows || [])
    details.addRow([
      text(row.employee_no),
      text(row.full_name),
      text(row.location_name),
      text(row.organization_unit_name),
      text(row.leave_type_name),
      text(row.request_no),
      LEAVE_STATUS[row.status]?.[0] || text(row.status),
      row.start_date,
      row.end_date,
      Number(row.requested_units),
      LEAVE_UNIT[row.unit],
    ]);
  details.getRow(1).font = { bold: true };
  details.views = [{ state: "frozen", ySplit: 1 }];
  details.autoFilter = { from: "A1", to: "K1" };
  details.columns.forEach((column, index) => {
    column.width = [1, 3, 4].includes(index) ? 32 : 23;
    column.numFmt = index === 9 ? "0" : "@";
  });
  return workbook.xlsx.writeBuffer();
}
