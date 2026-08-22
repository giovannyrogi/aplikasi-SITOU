import { z } from "zod";
import {
  optionalIndonesianMobileSchema,
  requiredIndonesianMobileSchema,
} from "../validation/indonesianPhone.js";

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
          nationalId: nullableText(30),
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
    educations: z
      .array(
        z.object({
          educationLevel: z.string().trim().min(1).max(30),
          institution: nullableText(200),
          fieldOfStudy: nullableText(150),
          graduationYear: z.coerce.number().int().min(1900).max(2200).nullable().optional(),
          isHighest: z.boolean().default(false),
          certificateFileId: z.coerce.number().int().positive().nullable().optional(),
        }),
      )
      .max(20)
      .default([]),
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
    if (value.identifiers.filter((item) => item.identifierType === "ktp").length > 1)
      context.addIssue({
        code: "custom",
        path: ["identifiers"],
        message: "KTP hanya dapat dicatat satu kali.",
      });
    const singularTypes = ["family_card", "bpjs_health", "bpjs_employment", "tax_npwp"];
    singularTypes.forEach((type) => {
      if (value.identifiers.filter((item) => item.identifierType === type).length > 1)
        context.addIssue({
          code: "custom",
          path: ["identifiers"],
          message: "Setiap jenis identitas utama hanya dapat dicatat satu kali.",
        });
    });
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
});
