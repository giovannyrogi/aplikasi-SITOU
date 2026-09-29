import { z } from "zod";

const organizationId = z.coerce.number().int().positive("Organisasi wajib dipilih.");

export const storageMaintenanceScanSchema = z.object({ organizationId }).strict();

export const storageMaintenanceCleanupSchema = z
  .object({
    organizationId,
    itemIds: z
      .array(z.coerce.number().int().positive())
      .min(1, "Pilih minimal satu file yang siap dihapus.")
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

export const storageMaintenanceActionSchema = z
  .object({
    organizationId,
    action: z.enum([
      "restore_metadata",
      "retain_official",
      "stage_cleanup",
      "finalize_cleanup",
    ]),
    reason: z.string().trim().max(1000).optional(),
    confirmationAccepted: z.literal(true, { error: "Konfirmasi tindakan wajib disetujui." }),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      ["retain_official", "stage_cleanup", "finalize_cleanup"].includes(value.action) &&
      (!value.reason || value.reason.length < 10)
    )
      context.addIssue({
        code: "custom",
        path: ["reason"],
        message: "Alasan tindakan minimal 10 karakter.",
      });
  });

export const storageMaintenanceQuarantineSchema = z
  .object({ organizationId, confirmationAccepted: z.literal(true) })
  .strict();
