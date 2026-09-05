import { z } from "zod";

const organizationId = z.coerce.number().int().positive("Organisasi wajib dipilih.");

export const storageMaintenanceScanSchema = z.object({ organizationId }).strict();

export const storageMaintenanceCleanupSchema = z
  .object({
    organizationId,
    itemIds: z
      .array(z.coerce.number().int().positive())
      .min(1, "Pilih minimal satu file yang akan dibersihkan.")
      .max(500, "Maksimal 500 file dapat diproses dalam satu permintaan."),
    confirmationAccepted: z.literal(true, {
      error: "Konfirmasi penghapusan permanen wajib disetujui.",
    }),
  })
  .strict()
  .superRefine((value, context) => {
    if (new Set(value.itemIds).size !== value.itemIds.length)
      context.addIssue({
        code: "custom",
        path: ["itemIds"],
        message: "Daftar file tidak boleh berisi pilihan ganda.",
      });
  });

export const storageMaintenanceCancelSchema = z.object({ organizationId }).strict();
