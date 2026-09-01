import { z } from "zod";

const id = (message) => z.coerce.number().int().positive(message);
const optionalId = z
  .union([id("ID tidak valid."), z.null()])
  .optional()
  .default(null);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid.");
const nullableText = (max) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((value) => value || null);

const leaveTypeBase = z
  .object({
    organizationId: id("Organisasi wajib dipilih."),
    name: z.string().trim().min(3, "Nama minimal 3 karakter.").max(100),
    category: z.enum(["leave", "permission", "sick", "official_duty", "other"]),
    unit: z.enum(["day", "hour"]),
    requiresAttachment: z.boolean().default(false),
    requiredAttachmentCategory: nullableText(40),
    usesBalance: z.boolean().default(true),
    annualAllowance: z.coerce
      .number()
      .int("Jatah tahunan harus berupa angka bulat.")
      .min(0)
      .max(999999)
      .nullable()
      .optional()
      .default(null),
    isActive: z.boolean().default(true),
  })
  .superRefine((value, context) => {
    if (value.usesBalance && (!value.annualAllowance || value.annualAllowance < 1))
      context.addIssue({
        code: "custom",
        path: ["annualAllowance"],
        message: "Isi jatah tahunan dengan angka bulat minimal 1.",
      });
    if (value.requiresAttachment && !value.requiredAttachmentCategory)
      context.addIssue({
        code: "custom",
        path: ["requiredAttachmentCategory"],
        message: "Pilih dokumen yang harus diunggah.",
      });
  });

export const leaveTypeCreateSchema = leaveTypeBase;
export const leaveTypeUpdateSchema = leaveTypeBase.safeExtend({ version: z.string().datetime() });

export const leaveRequestCreateSchema = z.object({
  organizationId: id("Organisasi wajib dipilih."),
  employeeId: id("Pegawai wajib dipilih."),
  leaveTypeId: id("Pilih cuti atau izin."),
  startDate: date,
  endDate: date,
  requestedUnits: z.coerce
    .number()
    .int("Durasi harus berupa angka bulat.")
    .positive("Durasi harus lebih dari 0.")
    .max(999999),
  reason: z.string().trim().min(10, "Alasan minimal 10 karakter.").max(2000),
  decisionNotes: nullableText(2000),
  attachmentFileIds: z.array(id("ID lampiran tidak valid.")).max(5).default([]),
});

export const leaveCancelSchema = z.object({
  organizationId: id("Organisasi wajib dipilih."),
  reason: z.string().trim().min(10, "Alasan pembatalan minimal 10 karakter.").max(2000),
  version: z.string().datetime(),
});

export const leaveAdjustmentSchema = z.object({
  organizationId: id("Organisasi wajib dipilih."),
  units: z.coerce
    .number()
    .int("Jumlah penyesuaian harus berupa angka bulat.")
    .min(-999999)
    .max(999999)
    .refine((value) => value !== 0, "Jumlah penyesuaian tidak boleh 0."),
  transactionType: z.enum(["adjustment", "carryover"]),
  reason: z.string().trim().min(10, "Alasan penyesuaian minimal 10 karakter.").max(2000),
});

export const leaveListFilterSchema = z.object({
  organizationId: optionalId,
  employeeId: optionalId,
  leaveTypeId: optionalId,
  locationId: optionalId,
  organizationUnitId: optionalId,
  positionId: optionalId,
  requestStatus: z
    .enum(["all", "draft", "submitted", "approved", "rejected", "cancelled"])
    .default("all"),
  category: z.enum(["all", "leave", "permission", "sick", "official_duty", "other"]).default("all"),
  periodState: z.enum(["all", "ongoing", "upcoming", "completed"]).default("all"),
  source: z
    .enum(["all", "hrd_entry", "employee_web", "employee_mobile", "import", "api"])
    .default("all"),
  balanceMode: z.enum(["all", "used", "unused"]).default("all"),
  attachment: z.enum(["all", "with", "without", "incomplete"]).default("all"),
  employeeStatus: z
    .enum(["all", "active", "probation", "suspended", "terminated", "retired", "deceased"])
    .default("all"),
  startDate: z.union([date, z.null()]).optional().default(null),
  endDate: z.union([date, z.null()]).optional().default(null),
  sort: z
    .enum([
      "start_desc",
      "start_asc",
      "end_desc",
      "employee_asc",
      "status_asc",
      "type_asc",
      "created_desc",
    ])
    .default("start_desc"),
});
