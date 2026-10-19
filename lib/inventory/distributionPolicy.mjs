import { z } from "zod";
const id = z.coerce
  .number({ error: "Pilihan tidak valid." })
  .int("Pilihan harus bilangan bulat.")
  .positive("Pilihan tidak valid.")
  .max(Number.MAX_SAFE_INTEGER, "Pilihan tidak valid.");
/** Tanggal penyaluran memilih cohort; seluruh efek dikembalikan/pembatalan dibatasi tanggal akhir. */
export const distributionSchema = z
  .object(
    {
      organizationId: id,
      from: z.iso.date({ error: "Tanggal awal tidak valid." }).optional(),
      to: z.iso.date({ error: "Tanggal akhir tidak valid." }).optional(),
      warehouseId: id.optional(),
      itemId: id.optional(),
      locationId: id.optional(),
      unitId: id.optional(),
      recipientId: id.optional(),
      search: z.string().trim().max(100, "Pencarian maksimal 100 karakter.").default(""),
      status: z
        .enum(["effective", "cancelled", "all"], {
          error: "Pilih status penyaluran yang tersedia.",
        })
        .default("effective"),
      pageSize: z.coerce
        .number({ error: "Jumlah data per halaman tidak valid." })
        .pipe(
          z.union([z.literal(10), z.literal(20), z.literal(50)], {
            error: "Pilih 10, 20, atau 50 data per halaman.",
          }),
        )
        .default(20),
      cursor: z.string().max(2000, "Halaman laporan tidak valid. Muat ulang hasil.").optional(),
    },
    { error: "Filter distribusi tidak valid. Muat ulang halaman." },
  )
  .strict()
  .refine((v) => !v.from || !v.to || v.from <= v.to, {
    path: ["to"],
    message: "Tanggal akhir tidak boleh sebelum tanggal awal.",
  });
export const DISTRIBUTION_PERIOD_HELP =
  "Data berdasarkan tanggal penyaluran yang dipilih. Pengembalian dan pembatalan dihitung hingga tanggal akhir periode.";
export { DISTRIBUTION_NET_HELP } from "./distributionLabels.mjs";
