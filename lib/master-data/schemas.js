import { z } from "zod";
import { optionalIndonesianMobileSchema } from "../validation/indonesianPhone.js";

const codeSchema = z
  .string()
  .trim()
  .min(2, "Kode minimal 2 karakter.")
  .max(30)
  .regex(/^[A-Za-z0-9_-]+$/, "Kode hanya boleh berisi huruf, angka, garis bawah, dan tanda hubung.")
  .transform((value) => value.toUpperCase());
const optionalId = z.union([z.coerce.number().int().positive(), z.null()]).optional().default(null);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid.");
const nullableText = (max) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => v || null);

export const subscriptionPeriodSchema = z
  .object({
    startsOn: dateSchema,
    endsOn: dateSchema,
    graceEndsOn: dateSchema.nullable().optional().default(null),
    notes: nullableText(2000),
  })
  .superRefine((value, context) => {
    if (value.endsOn < value.startsOn)
      context.addIssue({
        code: "custom",
        path: ["endsOn"],
        message: "Tanggal berakhir tidak boleh sebelum tanggal mulai.",
      });
    if (value.graceEndsOn && value.graceEndsOn < value.endsOn)
      context.addIssue({
        code: "custom",
        path: ["graceEndsOn"],
        message: "Masa tenggang tidak boleh berakhir sebelum masa langganan.",
      });
  });

const organizationIdentitySchema = z.object({
  code: codeSchema,
  name: z.string().trim().min(2, "Nama minimal 2 karakter.").max(200),
  legalName: nullableText(250),
  organizationType: z.enum(["holding", "company", "agency"]),
  parentId: optionalId,
  timezone: z.string().trim().min(3).max(50).default("Asia/Makassar"),
  isActive: z.boolean().default(true),
});
export const organizationCreateSchema = organizationIdentitySchema.extend({
  initialSubscription: subscriptionPeriodSchema,
});
export const organizationUpdateSchema = organizationIdentitySchema.extend({
  version: z.string().datetime({ offset: true }),
});
export const subscriptionActionSchema = z.object({
  action: z.enum(["suspend", "cancel", "restore"]),
  reason: z.string().trim().min(5, "Alasan minimal 5 karakter.").max(2000),
  version: z.string().datetime({ offset: true }),
});

export const locationSchema = z
  .object({
    organizationId: z.coerce.number().int().positive("Organisasi wajib dipilih."),
    parentLocationId: optionalId,
    code: codeSchema,
    name: z.string().trim().min(2).max(200),
    locationType: z.enum(["head_office", "branch", "market", "site", "warehouse", "other"]),
    address: nullableText(1000),
    latitude: z.coerce.number().min(-90).max(90).nullable().optional(),
    longitude: z.coerce.number().min(-180).max(180).nullable().optional(),
    operationalFrom: dateSchema,
    operationalUntil: dateSchema.nullable().optional(),
    isActive: z.boolean().default(true),
    version: z.string().datetime({ offset: true }).optional(),
  })
  .superRefine((value, context) => {
    if ((value.latitude == null) !== (value.longitude == null))
      context.addIssue({
        code: "custom",
        path: ["latitude"],
        message: "Latitude dan longitude harus diisi bersama.",
      });
    if (value.operationalUntil && value.operationalUntil < value.operationalFrom)
      context.addIssue({
        code: "custom",
        path: ["operationalUntil"],
        message: "Tanggal berakhir tidak boleh sebelum tanggal mulai.",
      });
  });

const organizationUnitBaseSchema = z.object({
  organizationId: z.coerce.number().int().positive("Organisasi wajib dipilih."),
  parentUnitId: optionalId,
  code: codeSchema,
  name: z.string().trim().min(2, "Nama minimal 2 karakter.").max(200),
  unitTypeId: z.coerce.number().int().positive("Jenis unit wajib dipilih."),
  locationIds: z.array(z.coerce.number().int().positive()).max(100).default([]),
  isActive: z.boolean().default(true),
});
export const organizationUnitCreateSchema = organizationUnitBaseSchema;
export const organizationUnitUpdateSchema = organizationUnitBaseSchema.extend({
  version: z.string().datetime({ offset: true }),
});

const organizationUnitTypeCodeSchema = z
  .string()
  .trim()
  .min(2, "Kode minimal 2 karakter.")
  .max(40, "Kode maksimal 40 karakter.")
  .regex(/^[A-Za-z][A-Za-z0-9_]*$/, "Kode hanya boleh berisi huruf, angka, dan garis bawah.")
  .transform((value) => value.toUpperCase());
const organizationUnitTypeBaseSchema = z.object({
  organizationId: z.coerce.number().int().positive("Organisasi wajib dipilih."),
  code: organizationUnitTypeCodeSchema,
  name: z.string().trim().min(2, "Nama minimal 2 karakter.").max(100),
  description: nullableText(1000),
  sortOrder: z.coerce.number().int().min(0, "Urutan tidak boleh negatif.").max(32767),
  isActive: z.boolean().default(true),
});
export const organizationUnitTypeCreateSchema = organizationUnitTypeBaseSchema;
export const organizationUnitTypeUpdateSchema = organizationUnitTypeBaseSchema.extend({
  version: z.string().datetime({ offset: true }),
});

const positionBaseSchema = z.object({
  organizationId: z.coerce.number().int().positive("Organisasi wajib dipilih."),
  code: codeSchema,
  name: z.string().trim().min(2, "Nama minimal 2 karakter.").max(200),
  grade: nullableText(50),
  levelNo: z.number().int().min(1).max(32767).nullable().optional().default(null),
  isManagerial: z.boolean().default(false),
  isActive: z.boolean().default(true),
});
export const positionCreateSchema = positionBaseSchema;
export const positionUpdateSchema = positionBaseSchema.extend({
  version: z.string().datetime({ offset: true }),
});

const employmentTypeBaseSchema = z.object({
  organizationId: z.coerce.number().int().positive("Organisasi wajib dipilih."),
  code: codeSchema,
  name: z.string().trim().min(2, "Nama minimal 2 karakter.").max(100),
  requiresEndDate: z.boolean().default(false),
  isActive: z.boolean().default(true),
});
export const employmentTypeCreateSchema = employmentTypeBaseSchema;
export const employmentTypeUpdateSchema = employmentTypeBaseSchema.extend({
  version: z.string().datetime({ offset: true }),
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
const adminPhoneSchema = optionalIndonesianMobileSchema;
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
export const passwordResetSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Konfirmasi password wajib diisi."),
  })
  .superRefine((value, context) => {
    if (value.password !== value.confirmPassword) {
      context.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: "Konfirmasi password tidak sama.",
      });
    }
  });
