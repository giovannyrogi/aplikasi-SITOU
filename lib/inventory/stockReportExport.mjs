import ExcelJS from "exceljs";
import { addInventoryReportInfo } from "./reportWorkbookInfo.mjs";
import { scaled } from "./replay.mjs";
import { STOCK_REPORT_HELP, STOCK_REPORT_QUANTITIES } from "./stockReportPolicy.mjs";
export async function stockReportWorkbook(report) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SITOU";
  const allWarehouses = !report.filters.warehouseId;
  addInventoryReportInfo(workbook, "Rekap Stok", [
    ["Organisasi", report.organization.name],
    ["Periode laporan", `${report.filters.from} — ${report.filters.to}`],
    [
      "Gudang",
      allWarehouses
        ? "Semua gudang berizin"
        : report.warehouseName || report.data[0]?.warehouse_name || "Gudang dipilih",
    ],
    [
      "Waktu pembuatan",
      new Intl.DateTimeFormat("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: report.organization.timezone,
      }).format(new Date(report.generatedAt)),
    ],
    ["Aturan perhitungan", STOCK_REPORT_HELP],
    ["Jumlah stok", "Stok awal + barang masuk"],
    ["Stok akhir", "Jumlah stok − barang keluar"],
    ["Satuan", "Jumlah barang dengan satuan berbeda tidak dijumlahkan."],
    ["Pencarian", report.filters.search || "Tidak digunakan"],
    ["Kategori", report.filters.categoryId ? "Kategori dipilih" : "Semua kategori"],
    [
      "Nama barang",
      report.filters.itemId ? report.data[0]?.name || "Barang dipilih" : "Semua barang",
    ],
    [
      "Histori",
      "Transaksi atau koreksi bertanggal sebelumnya dapat memperbarui hasil laporan. Waktu pembuatan tercantum pada laporan.",
    ],
  ]);
  const sheet = workbook.addWorksheet("Rekap Stok", {
    pageSetup: {
      orientation: "landscape",
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });
  const headers = [
    "No",
    "Nama barang",
    "Satuan",
    ...STOCK_REPORT_QUANTITIES.map(([, label]) => label),
  ];
  if (allWarehouses) headers.splice(2, 0, "Gudang");
  const count = headers.length;
  const heading = sheet.addRow(headers);
  heading.font = { bold: true, color: { argb: "FFFFFFFF" } };
  heading.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE60023" } };
  for (const [index, entry] of report.data.entries()) {
    const values = [index + 1, `${entry.name} (${entry.code})`, entry.unit_name];
    if (allWarehouses) values.splice(2, 0, entry.warehouse_name);
    for (const [key] of STOCK_REPORT_QUANTITIES) {
      const n = scaled(entry[key]);
      values.push(
        n <= BigInt(Number.MAX_SAFE_INTEGER) && n >= -BigInt(Number.MAX_SAFE_INTEGER)
          ? Number(n) / 1000
          : entry[key],
      );
    }
    const row = sheet.addRow(values);
    for (let c = allWarehouses ? 5 : 4; c < (allWarehouses ? 10 : 9); c++) {
      const key = STOCK_REPORT_QUANTITIES[c - (allWarehouses ? 5 : 4)][0];
      const fraction = (entry[key].split(".")[1] || "").replace(/0+$/, "");
      row.getCell(c).numFmt =
        typeof row.getCell(c).value === "number"
          ? `#,##0${fraction ? "." + "0".repeat(fraction.length) : ""}`
          : "@";
    }
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFDCE1EA" } },
        bottom: { style: "thin", color: { argb: "FFDCE1EA" } },
        left: { style: "thin", color: { argb: "FFDCE1EA" } },
        right: { style: "thin", color: { argb: "FFDCE1EA" } },
      };
      cell.alignment = { vertical: "middle", wrapText: true };
    });
  }
  sheet.columns = headers.map((label) => ({
    width: label === "Nama barang" ? 32 : label === "Gudang" ? 26 : label === "No" ? 7 : 17,
  }));
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, sheet.rowCount), column: count },
  };
  sheet.pageSetup.printTitlesRow = "1:1";
  return workbook.xlsx.writeBuffer();
}
