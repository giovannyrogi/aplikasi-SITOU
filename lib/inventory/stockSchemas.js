import { z } from "zod";
const id = z.coerce.number({error:"Pilihan tidak valid."}).int("Pilihan tidak valid.").positive("Pilihan tidak valid.").max(Number.MAX_SAFE_INTEGER,"Pilihan tidak valid.");
export const stockFiltersSchema = z.object({
  organizationId: id,
  warehouseId: id.optional(),
  categoryId: id.optional(),
  itemId: id.optional(),
  search: z.string().trim().max(100,"Pencarian maksimal 100 karakter.").default(""),
  condition: z.enum(["all", "recorded", "attention", "unrecorded", "empty", "low", "sufficient"],{error:"Pilih kondisi stok yang tersedia."}).default("all"),
  status: z.enum(["all", "active", "inactive"],{error:"Pilih status yang tersedia."}).default("active"),
  pageSize: z.coerce.number({error:"Ukuran halaman tidak valid."}).pipe(z.union([z.literal(10), z.literal(20), z.literal(50)],{error:"Pilih 10, 20, atau 50 data per halaman."})).default(20),
  cursor: z.string().max(2000,"Halaman tidak berlaku. Muat ulang daftar.").optional(),
});
export const stockHistorySchema = stockFiltersSchema.extend({
  warehouseId: id,
  itemId: id,
  from: z.iso.date({error:"Tanggal awal tidak valid."}).optional(),
  to: z.iso.date({error:"Tanggal akhir tidak valid."}).optional(),
}).refine((value) => !value.from || !value.to || value.from <= value.to, {
  path: ["to"], message: "Tanggal akhir tidak boleh sebelum tanggal awal.",
});
