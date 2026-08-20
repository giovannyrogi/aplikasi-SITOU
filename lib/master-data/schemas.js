import { z } from "zod";

const codeSchema = z
  .string()
  .trim()
  .min(2, "Kode minimal 2 karakter.")
  .max(30, "Kode maksimal 30 karakter.")
  .regex(/^[A-Za-z0-9_-]+$/, "Kode hanya boleh berisi huruf, angka, garis bawah, dan tanda hubung.")
  .transform((value) => value.toUpperCase());

const optionalId = z.union([z.coerce.number().int().positive(), z.null()]).optional().default(null);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid.");

export const organizationSchema = z
  .object({
    code: codeSchema,
    name: z.string().trim().min(2, "Nama minimal 2 karakter.").max(200),
    legalName: z
      .string()
      .trim()
      .max(250)
      .nullable()
      .optional()
      .transform((v) => v || null),
    organizationType: z.enum(["holding", "company", "agency"]),
    parentId: optionalId,
    timezone: z.string().trim().min(3).max(50).default("Asia/Makassar"),
    activeFrom: dateSchema,
    activeUntil: dateSchema,
    isActive: z.boolean().default(true),
    version: z.string().datetime({ offset: true }).optional(),
  })
  .superRefine((value, context) => {
    if (value.activeUntil < value.activeFrom) {
      context.addIssue({
        code: "custom",
        path: ["activeUntil"],
        message: "Tanggal berakhir tidak boleh sebelum tanggal mulai.",
      });
    }
  });

export const locationSchema = z
  .object({
    organizationId: z.coerce.number().int().positive("Organisasi wajib dipilih."),
    parentLocationId: optionalId,
    code: codeSchema,
    name: z.string().trim().min(2).max(200),
    locationType: z.enum(["head_office", "branch", "market", "site", "warehouse", "other"]),
    address: z
      .string()
      .trim()
      .max(1000)
      .nullable()
      .optional()
      .transform((v) => v || null),
    latitude: z.coerce.number().min(-90).max(90).nullable().optional(),
    longitude: z.coerce.number().min(-180).max(180).nullable().optional(),
    activeFrom: dateSchema,
    activeUntil: dateSchema.nullable().optional(),
    isActive: z.boolean().default(true),
    version: z.string().datetime({ offset: true }).optional(),
  })
  .superRefine((value, context) => {
    if ((value.latitude == null) !== (value.longitude == null)) {
      context.addIssue({
        code: "custom",
        path: ["latitude"],
        message: "Latitude dan longitude harus diisi bersama.",
      });
    }
    if (value.activeUntil && value.activeUntil < value.activeFrom) {
      context.addIssue({
        code: "custom",
        path: ["activeUntil"],
        message: "Tanggal berakhir tidak boleh sebelum tanggal mulai.",
      });
    }
  });

const passwordSchema = z
  .string()
  .min(6, "Password minimal 6 karakter.")
  .refine((value) => new TextEncoder().encode(value).length <= 72, "Password maksimal 72 byte.")
  .regex(/[a-z]/, "Password wajib memiliki huruf kecil.")
  .regex(/[A-Z]/, "Password wajib memiliki huruf besar.")
  .regex(/\d/, "Password wajib memiliki angka.")
  .regex(/[^A-Za-z0-9]/, "Password wajib memiliki simbol.");

const adminUsernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(100)
  .regex(/^[A-Za-z0-9._-]+$/)
  .transform((v) => v.toLowerCase());
const adminEmailSchema = z
  .string()
  .trim()
  .email("Email tidak valid.")
  .max(250)
  .transform((v) => v.toLowerCase());
const adminPhoneSchema = z
  .string()
  .trim()
  .max(30)
  .nullable()
  .optional()
  .transform((v) => v || null);
const locationIdsSchema = z
  .array(z.coerce.number().int().positive())
  .min(1, "Pilih minimal satu lokasi.")
  .max(100);

export const adminUserCreateSchema = z.object({
  username: adminUsernameSchema,
  email: adminEmailSchema,
  fullName: z.string().trim().min(2).max(200),
  phone: adminPhoneSchema,
  password: passwordSchema,
  organizationId: z.coerce.number().int().positive(),
  locationIds: locationIdsSchema,
  isActive: z.boolean().default(true),
});

export const adminUserUpdateSchema = z.object({
  username: adminUsernameSchema,
  email: adminEmailSchema,
  fullName: z.string().trim().min(2).max(200),
  phone: adminPhoneSchema,
  locationIds: locationIdsSchema,
  isActive: z.boolean(),
  version: z.string().datetime({ offset: true }),
});

export const passwordResetSchema = z.object({ password: passwordSchema });
