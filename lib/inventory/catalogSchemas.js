import { z } from "zod";
const id = z.coerce.number().int().positive("Pilihan tidak valid.");
const base = z.object({
  organizationId: id,
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, "Kode wajib diisi.")
    .max(40)
    .regex(/^[A-Z0-9_-]+$/, "Gunakan huruf, angka, garis bawah atau tanda hubung."),
  name: z.string().trim().min(1, "Nama wajib diisi.").max(100),
  notes: z.string().trim().max(2000).nullable().optional().default(null),
  isActive: z.boolean(),
});
export const catalogSchemas = {
  categories: base.strict(),
  // Kode opsional hanya untuk kompatibilitas klien lama; UI satuan tidak meminta kode.
  units: base.extend({ code: base.shape.code.optional(), allowsFractional: z.boolean() }).strict(),
  items: base
    .extend({
      name: z.string().trim().min(1, "Nama barang wajib diisi.").max(160),
      categoryId: id,
      unitId: id,
      photoAction: z.enum(["keep", "remove"]).default("keep"),
    })
    .strict(),
};
export const catalogUpdateSchemas = Object.fromEntries(
  Object.entries(catalogSchemas).map(([kind, schema]) => [
    kind,
    schema.extend({ version: z.number().int().positive() }),
  ]),
);
export const itemWarehouseSchema = z
  .object({
    organizationId: id,
    warehouseId: id,
    minimumStock: z
      .number()
      .finite()
      .min(0, "Batas minimum tidak boleh negatif.")
      .max(999999999999)
      .multipleOf(0.001, "Maksimal tiga angka desimal."),
    isActive: z.boolean(),
    version: z.number().int().min(0),
  })
  .strict();
