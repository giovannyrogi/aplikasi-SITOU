import ExcelJS from "exceljs";
import { REPORT_TITLES } from "./policy.mjs";
import { reportColumns, reportValue } from "./columns.mjs";

/** Excel menggunakan string literal untuk nilai pengguna, bukan formula atau hyperlink otomatis. */
export async function buildReportWorkbook(kind, report) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SITOU";
  const sheet = workbook.addWorksheet("Laporan");
  sheet.addRow([REPORT_TITLES[kind]]);
  sheet.addRow(["Organisasi", report.organization.name]);
  sheet.addRow(["Tanggal acuan", report.asOf]);
  sheet.addRow(["Waktu ekspor (UTC)", report.generatedAt]);
  const groups = {
    upcoming: "Akan berakhir / mencapai usia pensiun",
    overdue: "Sudah lewat",
    all: "Semua dalam periode",
    invalid: "Tanggal lahir perlu diperiksa",
  };
  sheet.addRow(["Kelompok", groups[report.filters.group]]);
  sheet.addRow([
    "Periode",
    report.filters.startDate || "Tanpa batas awal",
    report.filters.endDate || "Tanpa batas akhir",
  ]);
  sheet.addRow(["Pencarian", report.filters.search || "Semua pegawai"]);
  for (const [key, label] of [
    ["locationId", "Lokasi"],
    ["organizationUnitId", "Divisi & Unit"],
    ["positionId", "Jabatan"],
    ["employmentTypeId", "Jenis kepegawaian"],
  ]) {
    sheet.addRow([label, report.filterLabels?.[key] || "Semua"]);
  }
  if (kind !== "retirements")
    sheet.addRow([
      "Kontrak lanjutan",
      { all: "Semua", yes: "Sudah tercatat", no: "Belum tercatat" }[report.filters.successor],
    ]);
  sheet.addRow(["Jumlah hasil", report.total, "Pegawai unik", report.employeeCount]);
  sheet.addRow([]);
  const columns = reportColumns(kind);
  const header = sheet.addRow(columns.map(([, label]) => label));
  header.font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: header.number }];
  sheet.autoFilter = {
    from: { row: header.number, column: 1 },
    to: { row: header.number, column: columns.length },
  };
  for (const row of report.rows) sheet.addRow(columns.map(([key]) => reportValue(row, key)));
  columns.forEach(([key], index) => {
    sheet.getColumn(index + 1).width = key === "full_name" || key === "tenure" ? 35 : 26;
    if (["employee_no", "contract_no"].includes(key)) sheet.getColumn(index + 1).numFmt = "@";
  });
  return workbook.xlsx.writeBuffer();
}
