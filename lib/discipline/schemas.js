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

export const disciplineCaseCreateSchema = z.object({
  organizationId: id("Organisasi wajib dipilih."),
  employeeId: id("Pegawai wajib dipilih."),
  severity: z.enum(["light", "moderate", "severe"]),
  incidentDate: date,
  description: z.string().trim().min(10, "Uraian minimal 10 karakter.").max(5000),
  employeeExplanation: nullableText(5000),
});

export const disciplineCaseUpdateSchema = z.object({
  organizationId: id("Organisasi wajib dipilih."),
  severity: z.enum(["light", "moderate", "severe"]),
  incidentDate: date,
  description: z.string().trim().min(10).max(5000),
  employeeExplanation: nullableText(5000),
  status: z.enum(["open", "investigating", "closed_no_action"]),
});

export const disciplinaryActionCreateSchema = z
  .object({
    organizationId: id("Organisasi wajib dipilih."),
    actionType: z.enum([
      "oral_warning",
      "sp1",
      "sp2",
      "sp3",
      "suspension",
      "salary_delay",
      "promotion_delay",
      "demotion",
      "fine",
      "termination",
      "other",
    ]),
    letterNo: nullableText(100),
    issuedDate: date,
    effectiveFrom: date,
    effectiveUntil: z.union([date, z.null()]).optional().default(null),
    status: z.enum(["draft", "active"]).default("draft"),
    directEscalation: z.boolean().default(false),
    escalationReason: nullableText(3000),
    documentFileId: optionalId,
    notes: nullableText(3000),
  })
  .superRefine((value, context) => {
    const written = value.actionType !== "oral_warning";
    if (value.status === "active" && written && !value.letterNo)
      context.addIssue({ code: "custom", path: ["letterNo"], message: "Nomor surat wajib diisi." });
    if (value.status === "active" && written && !value.documentFileId)
      context.addIssue({
        code: "custom",
        path: ["documentFileId"],
        message: "Dokumen surat wajib diunggah sebelum tindakan diaktifkan.",
      });
    if (value.directEscalation && !value.escalationReason)
      context.addIssue({
        code: "custom",
        path: ["escalationReason"],
        message: "Alasan eskalasi langsung wajib diisi.",
      });
  });

export const disciplinaryActionUpdateSchema = disciplinaryActionCreateSchema.safeExtend({
  status: z.enum(["draft", "active", "revoked", "appealed"]),
});

export const disciplineListFilterSchema = z.object({
  organizationId: optionalId,
  employeeId: optionalId,
  severity: z.enum(["all", "light", "moderate", "severe"]).default("all"),
  caseStatus: z
    .enum(["all", "open", "investigating", "closed_no_action", "action_issued"])
    .default("all"),
});
