import { z } from "zod";

/** Batas teknis mencegah salah input; usia sebenarnya mengikuti kebijakan organisasi. */
export const retirementPolicySchema = z
  .object({
    retirementAge: z
      .number()
      .int("Usia pensiun harus berupa tahun bulat.")
      .min(18, "Usia pensiun minimal 18 tahun.")
      .max(100, "Usia pensiun maksimal 100 tahun."),
    version: z.number().int().min(0),
    reason: z
      .string()
      .trim()
      .min(5, "Alasan perubahan minimal 5 karakter.")
      .max(1000, "Alasan perubahan maksimal 1.000 karakter."),
  })
  .strict();
