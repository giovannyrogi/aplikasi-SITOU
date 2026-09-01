import { z } from "zod";
import { optionalIndonesianMobileSchema } from "../validation/indonesianPhone.js";
import { accountPasswordValueSchema } from "../access/schemas.js";

export const selfProfileUpdateSchema = z
  .object({
    preferredName: z.string().trim().max(100).nullable().optional(),
    personalEmail: z
      .string()
      .trim()
      .email("Email pribadi tidak valid.")
      .max(200)
      .nullable()
      .optional(),
    whatsapp: optionalIndonesianMobileSchema,
    fullName: z.string().trim().min(2).max(200).optional(),
    email: z.string().trim().email("Email tidak valid.").max(200).nullable().optional(),
  })
  .strict();

export const selfProfileLinkSchema = z
  .object({
    employeeId: z.coerce.number().int().positive("Profil pegawai wajib dipilih."),
  })
  .strict();

export const selfPasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Password saat ini wajib diisi."),
    newPassword: accountPasswordValueSchema,
    confirmPassword: z.string(),
  })
  .strict()
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Konfirmasi password tidak sama.",
  });
