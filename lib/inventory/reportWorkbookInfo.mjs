/** Sheet informasi bersama ekspor Inventaris; data selalu berada pada sheet berikutnya. */
export function addInventoryReportInfo(workbook, title, rows) {
  const sheet = workbook.addWorksheet("Informasi Laporan");
  sheet.columns = [{ width: 34 }, { width: 110 }];
  sheet.addRow([title]);
  sheet.mergeCells("A1:B1");
  sheet.getRow(1).height = 30;
  sheet.getRow(1).font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE60023" } };
  sheet.getRow(1).alignment = { vertical: "middle" };
  for (const values of rows) {
    const row = sheet.addRow(values);
    row.alignment = { vertical: "top", wrapText: true };
    row.getCell(1).font = { bold: true };
    row.height = Math.max(24, Math.ceil(String(values[1] ?? "").length / 95) * 17 + 8);
    row.eachCell((cell) => {
      cell.border = { bottom: { style: "thin", color: { argb: "FFE5E7EB" } } };
    });
  }
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  workbook.views = [{ activeTab: 0 }];
  return sheet;
}
