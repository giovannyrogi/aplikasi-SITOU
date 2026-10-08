import { z } from "zod";

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
    roleCode: z.enum(["hrd", "leader", "employee"]).default("employee"),
    locationScopeMode: z.enum(["all", "selected"]).default("all"),
    locationIds: z.array(requiredId("Lokasi tidak valid.")).max(100).default([]),
    isActive: z.boolean().default(true),
    packageAccess: z
      .array(
        z
          .object({
            packageCode: z.enum(["inventory_reader", "inventory_manager"]),
            scopeMode: z.enum(["all", "selected"]),
            warehouseIds: z.array(requiredId("Gudang tidak valid.")).max(100).default([]),
          })
          .strict()
          .superRefine((value, context) => {
            if (value.scopeMode === "selected" && !value.warehouseIds.length)
              context.addIssue({
                code: "custom",
                path: ["warehouseIds"],
                message: "Pilih minimal satu gudang.",
              });
            if (new Set(value.warehouseIds).size !== value.warehouseIds.length)
              context.addIssue({
                code: "custom",
                path: ["warehouseIds"],
                message: "Gudang tidak boleh berulang.",
              });
            if (value.scopeMode === "all" && value.warehouseIds.length)
              context.addIssue({
                code: "custom",
                path: ["warehouseIds"],
                message: "Cakupan seluruh gudang tidak menggunakan pilihan gudang.",
              });
          }),
      )
      .max(2)
      .optional(),
  })
  .strict("Payload akun memuat field yang tidak didukung.")
  .superRefine((value, context) => {
    if (
      value.packageAccess &&
      new Set(value.packageAccess.map((g) => g.packageCode)).size !== value.packageAccess.length
    )
      context.addIssue({
        code: "custom",
        path: ["packageAccess"],
        message: "Paket akses tidak boleh berulang.",
      });
    if (value.roleCode === "employee" && !value.employeeId)
      context.addIssue({
        code: "custom",
        path: ["employeeId"],
        message: "Profil pegawai wajib dipilih untuk akun Pegawai.",
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

export const accountCreateSchema = accountBase
  .safeExtend({ password, confirmPassword: z.string().min(1, "Konfirmasi password wajib diisi.") })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Konfirmasi password tidak sama.",
  });
export const accountUpdateSchema = accountBase.safeExtend({
  version: z.string().datetime({ offset: true }),
});
export const accountPasswordSchema = z
  .object({ organizationId: optionalOrganizationId, password, confirmPassword: z.string() })
  .strict()
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Konfirmasi password tidak sama.",
  });
export const accountListFilterSchema = z.object({
  organizationId: optionalOrganizationId,
  roleCode: z.enum(["all", "hrd", "leader", "employee"]).default("all"),
});
export const accountReferenceQuerySchema = z.object({
  organizationId: optionalOrganizationId,
  accountId: optionalId,
});
export { password as accountPasswordValueSchema };
