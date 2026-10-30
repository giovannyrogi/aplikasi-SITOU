import { z } from "zod";
import { dateValid, validateRules } from "./rules.mjs";
import { validateShiftChoices } from "./shiftGroups.mjs";
const id = z
  .string()
  .regex(/^[1-9]\d*$/, "Pilihan tidak valid.")
  .max(18);
export const date = z.string().refine(dateValid, "Tanggal tidak valid.");
const nullableTime = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Jam tidak valid.")
  .nullable()
  .default(null);
const bounded = z.number().int().min(0).max(1440);
export const rulesSchema = z
  .object({
    type: z.enum(["fixed", "flexible", "off", "field"]),
    startTime: nullableTime,
    endTime: nullableTime,
    windowStart: nullableTime,
    windowEnd: nullableTime,
    latestFinish: nullableTime,
    requiredMinutes: bounded.default(0),
    breakMinutes: bounded.default(0),
    deductBreak: z.boolean().default(true),
    nextDay: z.boolean().default(false),
    lateTolerance: bounded.default(0),
    earlyTolerance: bounded.default(0),
  })
  .strict()
  .superRefine((r, c) => {
    try {
      if (r.type === "field") return; // Hanya kompatibilitas metadata existing; service menolak aturan baru.
      validateRules(r);
    } catch (e) {
      c.addIssue({
        code: "custom",
        path: [
          Object.keys(e.fieldErrors || {})[0]
            ?.split(".")
            .at(-1) || "type",
        ],
        message: e.message,
      });
    }
  });
const base = {
  requestKey: z.string().uuid(),
  organizationId: id,
  name: z.string().trim().min(1, "Isi nama.").max(100),
  isActive: z.boolean().default(true),
};
const edit = { id: id.optional(), version: z.number().int().positive().optional() };
export const shiftSchema = z
  .object({
    ...base,
    ...edit,
    rules: rulesSchema,
    effectiveFrom: date.optional(),
    reason: z.string().trim().min(5, "Isi alasan minimal 5 karakter.").max(1000).optional(),
  })
  .strict();
export const calendarSchema = z
  .object({
    ...base,
    ...edit,
    days: z
      .array(
        z
          .object({ date, name: z.string().trim().min(1, "Isi nama hari libur.").max(100) })
          .strict(),
      )
      .max(366),
  })
  .strict();
export const patternSchema = z
  .object({
    ...base,
    ...edit,
    patternType: z.enum(["weekly", "rotation"]),
    cycleDays: z.number().int().min(1).max(366),
    calendarId: id.nullable().default(null),
    holidayPolicy: z.enum(["calendar", "roster"]),
    days: z
      .array(
        z.object({ day: z.number().int().min(1).max(366), shiftIds: z.array(id).max(16) }).strict(),
      )
      .min(1)
      .max(366),
  })
  .strict();
export const workScheduleSchema = z
  .object({
    patternId: id,
    from: date,
    until: date.nullable().optional(),
    anchorDate: date.optional(),
  })
  .strict();
export const templateSchema = z
  .object({
    ...base,
    ...edit,
    patternType: z.enum(["weekly", "rotation"]),
    cycleDays: z.number().int().min(1).max(366),
    calendarId: id.nullable().default(null),
    holidayPolicy: z.enum(["calendar", "roster"]),
    days: z
      .array(
        z
          .object({
            day: z.number().int().min(1).max(366),
            sessions: z
              .array(
                z.union([
                  z.object({ shiftId: id }).strict(),
                  z.object({ rules: rulesSchema }).strict(),
                ]),
              )
              .max(16),
          })
          .strict(),
      )
      .min(1)
      .max(366),
  })
  .strict();
export const shiftGroupSchema = z
  .object({
    ...base,
    ...edit,
    workingDays: z.array(z.number().int().min(1).max(7)).min(1, "Pilih hari kerja.").max(7),
    calendarId: id.nullable().default(null),
    holidayPolicy: z.enum(["calendar", "roster"]),
    shifts: z
      .array(
        z
          .object({
            name: z.string().trim().min(1, "Isi nama shift.").max(100),
            rules: rulesSchema,
          })
          .strict(),
      )
      .min(1, "Tambahkan minimal satu shift.")
      .max(16, "Maksimal 16 shift dalam satu jadwal."),
  })
  .strict()
  .superRefine((value, context) => {
    if (new Set(value.workingDays).size !== value.workingDays.length)
      context.addIssue({
        code: "custom",
        path: ["workingDays"],
        message: "Hari kerja tidak boleh berulang.",
      });
    if (value.holidayPolicy === "calendar" && !value.calendarId)
      context.addIssue({ code: "custom", path: ["calendarId"], message: "Pilih kalender libur." });
    value.shifts.forEach((shift, index) => {
      if (`${value.name} — ${shift.name}`.length > 100)
        context.addIssue({
          code: "custom",
          path: ["shifts", index, "name"],
          message: "Gabungan nama jadwal dan nama shift maksimal 100 karakter.",
        });
    });
    validateShiftChoices(value.shifts).forEach((issue) =>
      context.addIssue({ code: "custom", ...issue }),
    );
  });
export const draftWorkScheduleSchema = z
  .object({
    patternId: id.nullable().optional(),
    from: z.string().max(10).nullable().optional(),
    until: z.string().max(10).nullable().optional(),
    anchorDate: z.string().max(10).nullable().optional(),
  })
  .strict()
  .nullable()
  .optional();
export const assignmentSchema = workScheduleSchema
  .extend({
    organizationId: id,
    employeeIds: z.array(id).min(1).max(100),
    reason: z.string().trim().min(5, "Isi alasan minimal 5 karakter.").max(1000),
    expectedVersions: z.record(z.string(), z.number().int().nonnegative()),
    requestKey: z.string().uuid(),
  })
  .strict();
export const exceptionSchema = z
  .object({
    organizationId: id,
    employeeId: id,
    date,
    shiftIds: z.array(id).max(16),
    reason: z.string().trim().min(5, "Isi alasan minimal 5 karakter.").max(1000),
    version: z.number().int().nonnegative(),
    requestKey: z.string().uuid(),
  })
  .strict();
export const rangeSchema = z
  .object({
    organizationId: id,
    employeeIds: z.array(id).min(1).max(100),
    from: date,
    until: date,
    replace: z.boolean().default(false),
    expectedVersions: z.record(z.string(), z.number().int().nonnegative()).default({}),
    requestKey: z.string().uuid().optional(),
  })
  .strict();
export const cancelSchema = z
  .object({
    organizationId: id,
    id,
    version: z.number().int().positive(),
    reason: z.string().trim().min(5, "Isi alasan minimal 5 karakter.").max(1000),
    requestKey: z.string().uuid(),
  })
  .strict();

/** Pesan default Zod diterjemahkan per request tanpa mengubah konfigurasi global web. */
export function scheduleValidationMessage(issue) {
  if (issue.code === "too_big")
    return `Maksimal ${issue.maximum} ${issue.origin === "string" ? "karakter" : "data"}.`;
  if (issue.code === "too_small")
    return `Minimal ${issue.minimum} ${issue.origin === "string" ? "karakter" : "data"}.`;
  if (issue.code === "unrecognized_keys") return "Ada isian yang tidak sesuai.";
  if (issue.code === "invalid_type")
    return issue.expected === "number" ? "Isi angka yang sesuai." : "Isi data yang sesuai.";
  if (issue.code === "invalid_format") return "Format tidak sesuai.";
  return "Pilihan tidak sesuai.";
}
