import { z } from "zod";
import { optionalIndonesianMobileSchema } from "../validation/indonesianPhone.js";

const requiredId = (message) => z.coerce.number().int().positive(message);
const optionalId = z
  .union([requiredId("Profil pegawai tidak valid."), z.null()])
  .optional()
  .default(null);
const optionalOrganizationId = z
  .union([requiredId("Organisasi tidak valid."), z.null()])
  .optional();
const password = z
  .string()
  .min(6, "Password minimal 6 karakter.")
  .refine((value) => new TextEncoder().encode(value).length <= 72, "Password maksimal 72 byte.")
  .regex(/[a-z]/, "Password wajib memiliki huruf kecil.")
  .regex(/[A-Z]/, "Password wajib memiliki huruf besar.")
  .regex(/\d/, "Password wajib memiliki angka.")
  .regex(/[^A-Za-z0-9]/, "Password wajib memiliki simbol.");

const accountBase = z
  .object({
    organizationId: optionalOrganizationId,
    employeeId: optionalId,
    username: z
      .string()
      .trim()
      .min(3)
      .max(80)
      .regex(/^[A-Za-z0-9._-]+$/, "Username tidak valid."),
    email: z.string().trim().email("Email tidak valid.").max(200),
    fullName: z.string().trim().min(2).max(200),
    phone: optionalIndonesianMobileSchema,
    roleCode: z.enum(["hrd", "leader", "employee"]),
    locationScopeMode: z.enum(["all", "selected"]).default("all"),
    locationIds: z.array(requiredId("Lokasi tidak valid.")).max(100).default([]),
    isActive: z.boolean().default(true),
  })
  .superRefine((value, context) => {
    if (value.roleCode === "employee" && !value.employeeId)
      context.addIssue({
        code: "custom",
        path: ["employeeId"],
        message: "Profil pegawai wajib dipilih untuk akun Karyawan.",
      });
    if (
      value.roleCode === "hrd" &&
      value.locationScopeMode === "selected" &&
      !value.locationIds.length
    )
      context.addIssue({
        code: "custom",
        path: ["locationIds"],
        message: "Pilih minimal satu lokasi.",
      });
  });

export const accountCreateSchema = accountBase.extend({ password });

export const accountUpdateSchema = accountBase.extend({
  version: z.string().datetime({ offset: true }),
});

export const accountPasswordSchema = z
  .object({
    organizationId: optionalOrganizationId,
    password,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Konfirmasi password tidak sama.",
  });

export const accountListFilterSchema = z.object({
  organizationId: optionalOrganizationId,
  roleCode: z.enum(["all", "hrd", "leader", "employee"]).default("all"),
});
