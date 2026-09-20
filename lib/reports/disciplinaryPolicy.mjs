import { z } from "zod";
import { validDate, validReportId } from "./policy.mjs";

export const DISCIPLINARY_REPORT_TITLE = "Sanksi Pegawai";
export const OFFICIAL_ACTION_STATUSES = [
  "active",
  "expired",
  "revoked",
  "appealed",
  "superseded",
];
export const DISCIPLINE_SEVERITIES = ["light", "moderate", "severe"];
export const REPORT_EMPLOYMENT_STATUSES = [
  "active",
  "probation",
  "suspended",
  "draft",
  "terminated",
  "retired",
  "deceased",
];

const optionalId = z.string().refine(validReportId, "Pilihan tidak valid.").optional();
const optionalDate = z
  .string()
  .refine(validDate, "Tanggal harus valid dengan format YYYY-MM-DD.")
  .optional();

const schema = z.object({
  organizationId: optionalId,
  locationId: optionalId,
  organizationUnitId: optionalId,
  positionId: optionalId,
  search: z.string().trim().max(120, "Pencarian maksimal 120 karakter.").default(""),
  employmentStatus: z.enum(["all", ...REPORT_EMPLOYMENT_STATUSES]).default("all"),
  severity: z.enum(["all", ...DISCIPLINE_SEVERITIES]).default("all"),
  actionTypeId: optionalId,
  actionStatus: z.enum(["all", ...OFFICIAL_ACTION_STATUSES]).default("all"),
  startDate: optionalDate,
  endDate: optionalDate,
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  cursor: z.string().max(1000).optional(),
});

/** Menormalkan filter laporan resmi tanpa pernah menyediakan pilihan draft. */
export function normalizeDisciplinaryReportFilters(input) {
  const parsed = schema.safeParse(input);
  const fail = (fieldErrors) => {
    const error = new Error(Object.values(fieldErrors)[0]);
    error.fieldErrors = fieldErrors;
    throw error;
  };
  if (!parsed.success)
    fail(
      Object.fromEntries(parsed.error.issues.map((issue) => [issue.path.join("."), issue.message])),
    );
  const filters = parsed.data;
  if (!!filters.startDate !== !!filters.endDate)
    fail({
      [filters.startDate ? "endDate" : "startDate"]: "Pilih tanggal awal dan akhir laporan.",
    });
  if (filters.startDate && filters.startDate > filters.endDate)
    fail({ endDate: "Tanggal akhir tidak boleh sebelum tanggal awal." });
  return filters;
}

/** Perubahan filter membatalkan cursor agar hasil selalu dimulai dari halaman pertama. */
export function changeDisciplinaryReportFilters(filters, key, value) {
  const next = { ...filters, [key]: value };
  delete next.cursor;
  return next;
}
