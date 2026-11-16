import { z } from "zod";
export const warehouseSchema = z
  .object({
    organizationId: z.coerce.number().int().positive(),
    locationId: z.coerce.number().int().positive("Lokasi wajib dipilih."),
    name: z.string().trim().min(1, "Nama gudang wajib diisi.").max(100),
    notes: z.string().trim().max(2000).nullable().optional().default(null),
    isActive: z.boolean(),
  })
  .strict();
export const warehouseUpdateSchema = warehouseSchema.extend({
  version: z.number().int().positive(),
});
export const moduleUpdateSchema = z
  .object({
    organizationId: z.coerce.number().int().positive(),
    isEnabled: z.boolean(),
    version: z.number().int().min(0),
  })
  .strict();
