import { z } from "zod";
import { disciplinaryDateErrors } from "./issuancePolicy.mjs";

const id = (message) => z.coerce.number().int().positive(message);
const optionalId = z
  .union([id("ID tidak valid."), z.null()])
  .optional()
  .default(null);
const date = z.iso.date({ error: "Tanggal tidak valid." });
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
    actionTypeId: id("Jenis tindakan wajib dipilih."),
    letterNo: nullableText(100),
    issuedDate: date,
    effectiveFrom: date,
    status: z.enum(["draft", "active"]).default("draft"),
    directEscalation: z.boolean().default(false),
    escalationReason: nullableText(3000),
    documentFileId: optionalId,
    notes: nullableText(3000),
    replacementActionIds: z
      .array(z.string().regex(/^[1-9]\d*$/))
      .max(100)
      .default([]),
  })
  .superRefine((value, context) => {
    for (const [field, message] of Object.entries(disciplinaryDateErrors(value)))
      context.addIssue({ code: "custom", path: [field], message });
    if (value.directEscalation && !value.escalationReason)
      context.addIssue({
        code: "custom",
        path: ["escalationReason"],
        message: "Alasan eskalasi langsung wajib diisi.",
      });
  });

export const disciplinaryActionUpdateSchema = disciplinaryActionCreateSchema.safeExtend({
  status: z.enum(["draft", "active"]),
});

export const disciplineCaseDeleteSchema = z.object({
  organizationId: id("Organisasi wajib dipilih."),
});

export const disciplinaryActionRevokeSchema = z.object({
  restorationActionIds: z
    .array(z.string().regex(/^[1-9]\d*$/))
    .max(100)
    .default([]),
  organizationId: id("Organisasi wajib dipilih."),
  reason: z
    .string()
    .trim()
    .min(10, "Alasan pencabutan minimal 10 karakter.")
    .max(3000, "Alasan pencabutan maksimal 3000 karakter."),
});

export const disciplineListFilterSchema = z.object({
  organizationId: optionalId,
  employeeId: optionalId,
  severity: z.enum(["all", "light", "moderate", "severe"]).default("all"),
  caseStatus: z
    .enum(["all", "open", "investigating", "closed_no_action", "action_issued"])
    .default("all"),
});
