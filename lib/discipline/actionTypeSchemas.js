import { z } from "zod";

const id = (message) => z.coerce.number().int().positive(message);

const base = z
  .object({
    organizationId: id("Organisasi wajib dipilih."),
    name: z.string().trim().min(2, "Nama sanksi minimal 2 karakter.").max(100),
    durationMode: z.enum(["fixed", "indefinite"]),
    durationValue: z.coerce.number().int().min(1).max(36500).nullable().optional(),
    durationUnit: z.enum(["day", "month"]).nullable().optional(),
    requiresDocument: z.boolean().default(true),
    isActive: z.boolean().default(true),
  })
  .superRefine((value, context) => {
    if (value.durationMode === "fixed" && !value.durationValue)
      context.addIssue({
        code: "custom",
        path: ["durationValue"],
        message: "Isi lama masa berlaku tindakan.",
      });
    if (value.durationMode === "fixed" && !value.durationUnit)
      context.addIssue({
        code: "custom",
        path: ["durationUnit"],
        message: "Pilih satuan masa berlaku.",
      });
  });

export const disciplinaryActionTypeCreateSchema = base;
export const disciplinaryActionTypeUpdateSchema = base.safeExtend({
  version: z.string().datetime(),
});
