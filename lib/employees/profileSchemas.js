import { z } from "zod";
import {
  optionalIndonesianMobileSchema,
  requiredIndonesianMobileSchema,
} from "../validation/indonesianPhone.js";
import { optionalIndonesianNationalIdSchema } from "../validation/indonesianNationalId.js";

const nullableText = (max) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((value) => value || null);
const nullableDate = z
  .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.null()])
  .optional()
  .default(null);

/** Satu riwayat pendidikan dipakai bersama oleh profil lengkap dan onboarding pegawai. */
export const employeeEducationSchema = z.object({
  educationLevel: z.string().trim().min(1, "Jenjang pendidikan wajib dipilih.").max(30),
  institution: z.string().trim().min(1, "Nama institusi pendidikan wajib diisi.").max(200),
  fieldOfStudy: nullableText(150),
  graduationYear: z.coerce
    .number()
    .int()
    .min(1900)
    .max(new Date().getFullYear(), "Tahun kelulusan tidak boleh melewati tahun berjalan.")
    .nullable()
    .optional(),
  isHighest: z.boolean().default(false),
  certificateFileId: z.coerce.number().int().positive().nullable().optional(),
});

/** Menambahkan issue pada setiap baris yang memakai kategori unik lebih dari sekali. */
function rejectDuplicateCategory(items, key, path, context, message) {
  const indexesByValue = new Map();
  items.forEach((item, index) => {
    const normalized = String(item?.[key] || "")
      .trim()
      .toLocaleLowerCase("id-ID");
    if (!normalized) return;
    indexesByValue.set(normalized, [...(indexesByValue.get(normalized) || []), index]);
  });
  indexesByValue.forEach((indexes) => {
    if (indexes.length < 2) return;
    indexes.forEach((index) =>
      context.addIssue({ code: "custom", path: [path, index, key], message }),
    );
  });
}

/** Schema section profil memvalidasi array terstruktur tanpa menerima nama tabel dari klien. */
export const employeeProfileSectionsSchema = z
  .object({
    identifiers: z
      .array(
        z.object({
          identifierType: z.enum([
            "ktp",
            "family_card",
            "bpjs_health",
            "bpjs_employment",
            "tax_npwp",
            "other",
          ]),
          identifierLabel: nullableText(100),
          identifierValue: z.string().trim().min(1).max(100),
          issuedAt: nullableDate,
          expiresAt: nullableDate,
          isVerified: z.boolean().default(false),
          documentFileId: z.coerce.number().int().positive().nullable().optional(),
        }),
      )
      .max(20)
      .default([]),
    bankAccounts: z
      .array(
        z.object({
          bankName: z.string().trim().min(1).max(100),
          accountNumber: z.string().trim().min(1).max(100),
          accountHolder: z.string().trim().min(1).max(200),
          isPrimary: z.boolean().default(false),
        }),
      )
      .max(10)
      .default([]),
    dependents: z
      .array(
        z.object({
          relationship: z.enum(["spouse", "child", "parent", "sibling", "other"]),
          fullName: z.string().trim().min(1).max(200),
          birthDate: nullableDate,
          nationalId: optionalIndonesianNationalIdSchema,
          phone: optionalIndonesianMobileSchema,
          isDependent: z.boolean().default(true),
          isEmergencyContact: z.boolean().default(false),
          notes: nullableText(1000),
        }),
      )
      .max(30)
      .default([]),
    emergencyContacts: z
      .array(
        z.object({
          fullName: z.string().trim().min(1).max(200),
          relationship: nullableText(50),
          phone: requiredIndonesianMobileSchema,
          address: nullableText(2000),
          isPrimary: z.boolean().default(false),
        }),
      )
      .max(10)
      .default([]),
    socialAccounts: z
      .array(
        z.object({
          platform: z.string().trim().min(1).max(50),
          handleOrUrl: z.string().trim().min(1).max(500),
        }),
      )
      .max(20)
      .default([]),
    educations: z.array(employeeEducationSchema).max(20).default([]),
    skills: z
      .array(
        z.object({
          skillName: z.string().trim().min(1).max(150),
          proficiencyLevel: nullableText(30),
          notes: nullableText(1000),
        }),
      )
      .max(50)
      .default([]),
    certifications: z
      .array(
        z.object({
          certificationName: z.string().trim().min(1).max(200),
          issuer: nullableText(200),
          credentialNo: nullableText(100),
          issuedAt: nullableDate,
          expiresAt: nullableDate,
          certificateFileId: z.coerce.number().int().positive().nullable().optional(),
        }),
      )
      .max(30)
      .default([]),
  })
  .superRefine((value, context) => {
    value.identifiers.forEach((identifier, index) => {
      if (identifier.identifierType === "ktp" && !/^\d{16}$/.test(identifier.identifierValue))
        context.addIssue({
          code: "custom",
          path: ["identifiers", index, "identifierValue"],
          message: "NIK KTP wajib terdiri dari tepat 16 digit.",
        });
      if (identifier.identifierType === "other" && !identifier.identifierLabel)
        context.addIssue({
          code: "custom",
          path: ["identifiers", index, "identifierLabel"],
          message: "Nama identitas wajib diisi untuk jenis lainnya.",
        });
    });
    rejectDuplicateCategory(
      value.identifiers,
      "identifierType",
      "identifiers",
      context,
      "Jenis identitas yang sama hanya dapat dicatat satu kali.",
    );
    rejectDuplicateCategory(
      value.socialAccounts,
      "platform",
      "socialAccounts",
      context,
      "Platform akun sosial yang sama hanya dapat dicatat satu kali.",
    );
    if (value.bankAccounts.filter((item) => item.isPrimary).length > 1)
      context.addIssue({
        code: "custom",
        path: ["bankAccounts"],
        message: "Hanya satu rekening yang dapat menjadi rekening utama.",
      });
    if (value.emergencyContacts.filter((item) => item.isPrimary).length > 1)
      context.addIssue({
        code: "custom",
        path: ["emergencyContacts"],
        message: "Hanya satu kontak darurat yang dapat menjadi kontak utama.",
      });
    if (value.educations.filter((item) => item.isHighest).length > 1)
      context.addIssue({
        code: "custom",
        path: ["educations"],
        message: "Hanya satu pendidikan yang dapat ditandai tertinggi.",
      });
  });

export const employeeProfileUpdateSchema = z.object({
  organizationId: z.coerce.number().int().positive(),
  profile: employeeProfileSectionsSchema,
  removedFileIds: z.array(z.coerce.number().int().positive()).max(100).default([]),
});

/** Descriptor upload menunjuk field profil tervalidasi tanpa menerima path database dari klien. */
export const employeeProfileMultipartSchema = employeeProfileUpdateSchema
  .extend({
    uploads: z
      .array(
        z.object({
          token: z.string().uuid(),
          target: z.enum(["profilePhoto", "identifier", "education", "certification"]),
          index: z.coerce.number().int().min(0).max(100).nullable().optional(),
        }),
      )
      .max(100)
      .default([]),
  })
  .superRefine((value, context) => {
    const tokens = value.uploads.map((upload) => upload.token);
    if (new Set(tokens).size !== tokens.length)
      context.addIssue({
        code: "custom",
        path: ["uploads"],
        message: "Setiap file upload wajib memiliki token unik.",
      });
    if (value.uploads.filter((upload) => upload.target === "profilePhoto").length > 1)
      context.addIssue({
        code: "custom",
        path: ["uploads"],
        message: "Pas foto hanya dapat diunggah satu kali.",
      });
    value.uploads.forEach((upload, index) => {
      if (upload.target !== "profilePhoto" && upload.index == null)
        context.addIssue({
          code: "custom",
          path: ["uploads", index, "index"],
          message: "Posisi file pada profil wajib tersedia.",
        });
    });
  });
