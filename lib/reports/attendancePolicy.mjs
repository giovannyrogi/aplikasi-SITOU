import { z } from "zod";
import { validDate, validReportId } from "./policy.mjs";
import { ATTENDANCE_INDICATOR, ATTENDANCE_STATUS } from "./attendancePresentation.mjs";

const id = z.string().refine(validReportId, "Pilihan tidak valid.").optional();
const date = z.string().refine(validDate, "Pilih tanggal yang valid.").optional();
const schema = z.object({
  locationId: id,
  organizationUnitId: id,
  positionId: id,
  employmentTypeId: id,
  startDate: date,
  endDate: date,
  search: z.string().trim().max(120, "Pencarian maksimal 120 karakter.").default(""),
  indicator: z
    .enum(
      [
        ...Object.keys(ATTENDANCE_INDICATOR),
        ...Object.keys(ATTENDANCE_STATUS).map((key) => `status:${key}`),
      ],
      { error: "Indikator tidak valid." },
    )
    .optional(),
  cursor: z.string().max(500).optional(),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});

export function normalizeAttendanceFilters(input, today) {
  const parsed = schema.safeParse(input);
  if (!parsed.success)
    return {
      fieldErrors: Object.fromEntries(
        parsed.error.issues.map((issue) => [issue.path[0], issue.message]),
      ),
    };
  const { startDate = today, endDate = today, ...filters } = parsed.data;
  if (Boolean(input.startDate) !== Boolean(input.endDate))
    return { fieldErrors: { startDate: "Pilih tanggal awal dan akhir." } };
  if (startDate > endDate)
    return { fieldErrors: { endDate: "Tanggal akhir tidak boleh sebelum tanggal awal." } };
  if (Date.parse(endDate) - Date.parse(startDate) >= 92 * 86400000)
    return { fieldErrors: { endDate: "Pilih rentang paling lama 92 hari." } };
  return { filters: { ...filters, startDate, endDate } };
}
