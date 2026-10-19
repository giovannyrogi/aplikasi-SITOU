import { DISTRIBUTION_QUANTITY_LABELS } from "./distributionLabels.mjs";
import ExcelJS from "exceljs";
import { addInventoryReportInfo } from "./reportWorkbookInfo.mjs";
import { scaled } from "./replay.mjs";
import { DISTRIBUTION_NET_HELP, DISTRIBUTION_PERIOD_HELP } from "./distributionPolicy.mjs";
/** Literal cells only; preserve large decimal quantities instead of rounding beyond safe precision. */
export async function distributionWorkbook(report) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SITOU";
  const rows = [
    ["Organisasi", report.organization.name],
    ["Periode penyaluran", `${report.filters.from} — ${report.filters.to}`],
    ["Pengembalian & pembatalan sampai", report.filters.to],
    [
      "Status penyaluran",
      { effective: "Berlaku", cancelled: "Dibatalkan", all: "Semua status" }[
        report.filters.status
      ],
    ],
    [
      "Waktu pembuatan",
      new Intl.DateTimeFormat("id-ID", {
        dateStyle: "medium",
        timeStyle: "medium",
        timeZone: report.organization.timezone,
      }).format(new Date(report.generatedAt)),
    ],
    ["Aturan periode", DISTRIBUTION_PERIOD_HELP],
    ["Penyaluran bersih", DISTRIBUTION_NET_HELP],
    [
      "Gudang asal",
      report.filters.warehouseId
        ? report.data[0]?.warehouse_name || "Tidak ada data"
        : "Semua gudang",
    ],
    [
      "Nama barang",
      report.filters.itemId ? report.data[0]?.item_name || "Tidak ada data" : "Semua barang",
    ],
    [
      "Lokasi tujuan",
      report.filters.locationId
        ? report.data[0]?.location_name || "Tidak ada data"
        : "Semua lokasi",
    ],
    [
      "Divisi & Unit",
      report.filters.unitId
        ? report.data[0]?.destination_unit_name || "Tidak ada data"
        : "Semua Divisi & Unit",
    ],
    [
      "Pegawai penerima",
      report.filters.recipientId
        ? report.data[0]?.recipient_name || "Pegawai penerima dipilih"
        : "Semua penerima",
    ],
    ["Pencarian", report.filters.search || "Tidak digunakan"],
  ];
  addInventoryReportInfo(workbook, "Laporan Distribusi Barang", rows);
  const sheet = workbook.addWorksheet("Distribusi");
  sheet.columns = [
    { header: "Tanggal penyaluran", key: "occurred_on", width: 20 },
    { header: "Gudang asal", key: "warehouse_name", width: 26 },
    { header: "Kode barang", key: "item_code", width: 20 },
    { header: "Nama barang", key: "item_name", width: 30 },
    { header: "Lokasi tujuan", key: "location_name", width: 26 },
    { header: "Divisi & Unit tujuan", key: "destination_unit_name", width: 30 },
    { header: "Pegawai penerima", key: "recipient_name", width: 30 },
    { header: "Nomor memo/permintaan", key: "reference_no", width: 24 },
    { header: "Jumlah penyaluran awal", key: "original_quantity", width: 23 },
    ...["distributed_quantity", "returned_quantity", "net_quantity"].map((key, i) => ({
      header: DISTRIBUTION_QUANTITY_LABELS[i],
      key,
      width: 23,
    })),
    { header: "Satuan", key: "unit_name", width: 15 },
    { header: "Tanggal pembatalan", key: "cancelled_on", width: 22 },
    { header: "Disimpan oleh", key: "actor_name", width: 24 },
  ];
  const quantityKeys = [
    "original_quantity",
    "distributed_quantity",
    "returned_quantity",
    "net_quantity",
  ];
  for (const entry of report.data) {
    const output = { ...entry },
      formats = {};
    for (const key of quantityKeys) {
      if (output[key] != null) {
        const n = scaled(output[key]);
        const safe = n <= BigInt(Number.MAX_SAFE_INTEGER) && n >= -BigInt(Number.MAX_SAFE_INTEGER);
        output[key] = safe ? Number(n) / 1000 : String(output[key]);
        // Excel dapat menampilkan pemisah desimal meskipun seluruh digit # kosong.
        // Gunakan jumlah desimal nyata agar 1 tampil 1, bukan 1. atau 1,.
        const decimals = (n < 0n ? -n : n) % 1000n;
        const digits = decimals.toString().padStart(3, "0").replace(/0+$/, "").length;
        formats[key] = safe ? `#,##0${digits ? "." + "0".repeat(digits) : ""}` : "@";
      }
    }
    const row = sheet.addRow(output);
    for (const [key, format] of Object.entries(formats))
      if (sheet.columns.some((c) => c.key === key)) row.getCell(key).numFmt = format;
  }
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: sheet.rowCount, column: sheet.columns.length },
  };
  sheet.getRow(1).font = { bold: true };
  return workbook.xlsx.writeBuffer();
}
