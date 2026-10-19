import { z } from "zod";
export const STOCK_REPORT_HELP =
  "Stok awal adalah saldo sebelum periode. Barang masuk dan keluar mencakup seluruh penambahan dan pengurangan stok, termasuk pengembalian, stok opname, dan pembatalan.";
export const STOCK_REPORT_QUANTITIES = [
  ["opening_balance", "Stok awal"],
  ["incoming", "Barang masuk"],
  ["available", "Jumlah stok"],
  ["outgoing", "Barang keluar"],
  ["closing_balance", "Stok akhir"],
];
const id = z.coerce
  .number({ error: "Pilihan tidak valid." })
  .int("Pilihan harus bilangan bulat.")
  .positive("Pilihan tidak valid.")
  .max(Number.MAX_SAFE_INTEGER, "Pilihan tidak valid.");
export const stockReportSchema = z
  .object(
    {
      organizationId: id,
      warehouseId: id.optional(),
      categoryId: id.optional(),
      itemId: id.optional(),
      from: z.iso.date({ error: "Tanggal tidak valid." }).optional(),
      to: z.iso.date({ error: "Tanggal tidak valid." }).optional(),
      search: z.string().trim().max(100, "Pencarian maksimal 100 karakter.").default(""),
      pageSize: z.coerce
        .number({ error: "Jumlah data per halaman tidak valid." })
        .pipe(
          z.union([z.literal(10), z.literal(20), z.literal(50)], {
            error: "Pilih 10, 20, atau 50 data per halaman.",
          }),
        )
        .default(20),
      cursor: z.string().max(2000, "Halaman laporan tidak berlaku. Muat ulang laporan.").optional(),
    },
    { error: "Filter laporan stok tidak valid. Muat ulang halaman." },
  )
  .strict()
  .refine((v) => !v.from || !v.to || v.from <= v.to, {
    path: ["to"],
    message: "Tanggal akhir tidak boleh sebelum tanggal awal.",
  });
