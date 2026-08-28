import { z } from "zod";
import { employeeEducationSchema, employeeProfileSectionsSchema } from "./profileSchemas.js";
import { optionalIndonesianMobileSchema } from "../validation/indonesianPhone.js";
import { requiredIndonesianNationalIdSchema } from "../validation/indonesianNationalId.js";
import { MARITAL_STATUS_VALUES } from "./profileOptions.js";

const requiredId = (message) => z.coerce.number().int().positive(message);
const optionalId = z.union([z.coerce.number().int().positive(), z.null()]).optional().default(null);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid.");
const nullableDate = z.union([date, z.null()]).optional().default(null);
const nullableText = (max) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((value) => value || null);

export const EMPLOYMENT_STATUSES = [
  "draft",
  "active",
  "probation",
  "leave",
  "suspended",
  "terminated",
  "retired",
  "deceased",
];

// Status final hanya boleh ditetapkan melalui workflow pengakhiran terkonfirmasi.
export const EDITABLE_EMPLOYMENT_STATUSES = ["draft", "active", "probation", "leave", "suspended"];

const employeeIdentitySchema = z.object({
  organizationId: requiredId("Organisasi wajib dipilih."),
  employeeNo: z
    .string()
    .trim()
    .min(1, "NIP wajib diisi.")
    .max(60)
    .transform((value) => value.toUpperCase()),
  fullName: z.string().trim().min(2, "Nama lengkap minimal 2 karakter.").max(200),
  preferredName: nullableText(100),
  nationalId: requiredIndonesianNationalIdSchema,
  birthPlace: nullableText(120),
  birthDate: nullableDate,
  gender: z.enum(["male", "female", "other", "undisclosed"]).nullable().optional().default(null),
  religion: nullableText(50),
  maritalStatus: z.enum(MARITAL_STATUS_VALUES).nullable().optional().default(null),
  bloodType: nullableText(3),
  nationality: z.string().trim().min(2).max(60).default("Indonesia"),
  joinedDate: nullableDate,
  employmentStatus: z
    .enum(EDITABLE_EMPLOYMENT_STATUSES, {
      error: "Status akhir hubungan kerja wajib dicatat melalui aksi Akhiri hubungan kerja.",
    })
    .default("active"),
});

const contactSchema = z.object({
  personalEmail: z.string().trim().email("Email pribadi tidak valid.").nullable().optional(),
  whatsapp: optionalIndonesianMobileSchema,
  ktpAddress: nullableText(2000),
  domicileAddress: nullableText(2000),
  village: nullableText(100),
  district: nullableText(100),
  city: nullableText(100),
  province: nullableText(100),
  postalCode: nullableText(10),
});

export const assignmentSchema = z
  .object({
    locationId: requiredId("Lokasi wajib dipilih."),
    organizationUnitId: requiredId("Divisi atau unit wajib dipilih."),
    positionId: optionalId,
    supervisorEmployeeId: optionalId,
    assignmentType: z.enum(["primary", "acting", "temporary", "additional"]).default("primary"),
    changeType: z
      .enum(["initial", "rotation", "transfer", "promotion", "demotion", "acting", "correction"])
      .default("initial"),
    effectiveFrom: date,
    decreeNo: nullableText(100),
    documentFileId: optionalId,
    notes: nullableText(2000),
  })
  .superRefine((value, context) => {
    if (!value.decreeNo)
      context.addIssue({ code: "custom", path: ["decreeNo"], message: "Nomor SK wajib diisi." });
    if (!value.documentFileId)
      context.addIssue({
        code: "custom",
        path: ["documentFileId"],
        message: "Dokumen SK wajib diunggah.",
      });
  });

const createContractSchema = ({ requireOfficialDocument }) =>
  z
    .object({
      employmentTypeId: requiredId("Jenis kepegawaian wajib dipilih."),
      contractNo: nullableText(100),
      startDate: date,
      endDate: nullableDate,
      status: z.enum(["draft", "active"]).default("active"),
      documentFileId: optionalId,
      notes: nullableText(2000),
    })
    .superRefine((value, context) => {
      if (value.endDate && value.endDate < value.startDate)
        context.addIssue({
          code: "custom",
          path: ["endDate"],
          message: "Tanggal akhir kontrak tidak boleh sebelum tanggal mulai.",
        });
      if (requireOfficialDocument && value.status === "active" && !value.contractNo)
        context.addIssue({
          code: "custom",
          path: ["contractNo"],
          message: "Nomor kontrak wajib diisi untuk kontrak aktif.",
        });
      if (requireOfficialDocument && value.status === "active" && !value.documentFileId)
        context.addIssue({
          code: "custom",
          path: ["documentFileId"],
          message: "Dokumen kontrak wajib diunggah untuk kontrak aktif.",
        });
    });

/** Onboarding boleh mencatat hubungan kerja sebelum nomor dan PDF kontrak tersedia. */
export const initialContractSchema = createContractSchema({ requireOfficialDocument: false });

/** Perubahan lifecycle kontrak resmi tetap mewajibkan nomor dan dokumen. */
export const contractSchema = createContractSchema({ requireOfficialDocument: true });

/** Pendidikan pada checkpoint boleh parsial karena draft disimpan sebelum step Pendidikan selesai. */
const employeeDraftEducationSchema = z
  .object({
    educationLevel: z.string().max(30).nullish(),
    institution: z.string().max(200).nullish(),
    fieldOfStudy: z.string().max(150).nullish(),
    graduationYear: z.coerce.number().int().min(1900).max(new Date().getFullYear()).nullish(),
    isHighest: z.boolean().optional(),
    certificateFileId: optionalId,
  })
  .strict();

/** Payload checkpoint hanya membatasi bentuk dan ukuran; kelengkapan divalidasi per step dan submit. */
export const employeeDraftSaveSchema = z.object({
  organizationId: requiredId("Organisasi wajib dipilih."),
  currentStep: z.coerce.number().int().min(0).max(3),
  version: z.coerce.number().int().positive(),
  payload: z
    .object({
      employeeNo: z.string().max(60).nullish(),
      fullName: z.string().max(200).nullish(),
      preferredName: z.string().max(100).nullish(),
      nationalId: z.string().max(30).nullish(),
      birthPlace: z.string().max(120).nullish(),
      birthDate: z.string().max(10).nullish(),
      gender: z.string().max(30).nullish(),
      religion: z.string().max(50).nullish(),
      maritalStatus: z.enum(MARITAL_STATUS_VALUES).nullish(),
      bloodType: z.string().max(3).nullish(),
      nationality: z.string().max(60).nullish(),
      joinedDate: z.string().max(10).nullish(),
      employmentStatus: z.string().max(30).nullish(),
      contact: z.record(z.string(), z.union([z.string().max(2000), z.null()])).optional(),
      contract: z.record(z.string(), z.union([z.string().max(2000), z.null()])).optional(),
      assignment: z.record(z.string(), z.union([z.string().max(2000), z.null()])).optional(),
      profile: z
        .object({ educations: z.array(employeeDraftEducationSchema).max(1).default([]) })
        .strict()
        .optional(),
    })
    .strict(),
});

export const employeeCreateSchema = employeeIdentitySchema.extend({
  profilePhotoFileId: optionalId,
  contact: contactSchema.default({}),
  assignment: assignmentSchema,
  contract: initialContractSchema,
  profile: employeeProfileSectionsSchema.default({}),
});

export const employeeUpdateSchema = employeeIdentitySchema.extend({
  contact: contactSchema.default({}),
  version: z.string().datetime({ offset: true }),
});

export const employeeTerminationSchema = z.object({
  organizationId: requiredId("Organisasi wajib dipilih."),
  status: z.enum(["terminated", "retired", "deceased"], {
    error: "Pilih jenis akhir hubungan kerja yang tersedia.",
  }),
  terminationDate: date,
  reason: z
    .string()
    .trim()
    .min(10, "Alasan wajib berisi minimal 10 karakter.")
    .max(2000, "Alasan maksimal 2.000 karakter."),
  version: z.string().datetime({ offset: true }),
});

export const employeeAssignmentCreateSchema = assignmentSchema.extend({
  organizationId: requiredId("Organisasi wajib dipilih."),
});

export const employeeContractCreateSchema = contractSchema.extend({
  organizationId: requiredId("Organisasi wajib dipilih."),
});

export const employeeContractCorrectionSchema = z
  .object({
    organizationId: requiredId("Organisasi wajib dipilih."),
    employmentTypeId: requiredId("Jenis kepegawaian wajib dipilih."),
    contractNo: z.string().trim().min(1, "Nomor kontrak wajib diisi.").max(100),
    startDate: date,
    endDate: nullableDate,
    documentFileId: requiredId("Dokumen kontrak wajib tersedia."),
    notes: nullableText(2000),
    version: z.string().datetime({ offset: true }),
  })
  .superRefine((value, context) => {
    if (value.endDate && value.endDate < value.startDate)
      context.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "Tanggal akhir kontrak tidak boleh sebelum tanggal mulai.",
      });
  });

export const employeeContractCancellationSchema = z.object({
  organizationId: requiredId("Organisasi wajib dipilih."),
  version: z.string().datetime({ offset: true }),
  reason: z.string().trim().min(5, "Alasan pembatalan minimal 5 karakter.").max(2000),
});

export const employeeListFilterSchema = z.object({
  organizationId: optionalId,
  locationId: optionalId,
  organizationUnitId: optionalId,
  positionId: optionalId,
  employmentTypeId: optionalId,
  sanction: z.enum(["all", "with_sanction", "without_sanction"]).default("all"),
});

export const employeeOptionQuerySchema = z.object({
  organizationId: requiredId("Organisasi wajib dipilih."),
  excludeId: optionalId,
});

export { contactSchema };
