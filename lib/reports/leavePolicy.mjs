import { z } from "zod";

const optionalId = z
  .string()
  .regex(/^[1-9]\d{0,18}$/, "Pilihan tidak valid.")
  .optional();
export function normalizeLeaveReportFilters(input, today) {
  const result = z
    .object({
      organizationId: optionalId,
      employeeId: optionalId,
      leaveTypeId: optionalId,
      locationId: optionalId,
      organizationUnitId: optionalId,
      year: z.coerce
        .number()
        .int()
        .min(1900)
        .max(2199)
        .default(Number(today.slice(0, 4))),
      search: z.string().trim().max(120, "Pencarian maksimal 120 karakter.").default(""),
      view: z.enum(["employees", "details"]).default("employees"),
      pageSize: z.coerce.number().int().min(1).max(50).default(10),
      cursor: z.string().max(1500).optional(),
    })
    .safeParse(input);
  if (!result.success) {
    const error = new Error("Periksa filter rekap cuti dan izin.");
    error.fieldErrors = Object.fromEntries(
      result.error.issues.map((i) => [i.path.join("."), i.message]),
    );
    throw error;
  }
  if (result.data.view === "details" && (!result.data.employeeId || !result.data.leaveTypeId)) {
    const error = new Error("Pilih pegawai dan jenis cuti/izin untuk melihat rincian.");
    error.fieldErrors = { employeeId: error.message, leaveTypeId: error.message };
    throw error;
  }
  return result.data;
}
