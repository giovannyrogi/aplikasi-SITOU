import { z } from "zod";

export const ORGANIZATION_MODULES = Object.freeze([
  {
    code: "inventory",
    label: "Inventaris",
    description: "Gudang, barang persediaan, transaksi dan laporan Inventaris.",
  },
  {
    code: "attendance",
    label: "Absensi",
    description: "Jadwal Kerja, Kalender Libur dan Jadwal Pegawai.",
  },
]);
export const ATTENDANCE_MENU_KEYS = Object.freeze([
  "work-shifts",
  "work-calendars",
  "work-schedules",
]);
export const moduleCodeSchema = z.enum(["inventory", "attendance"]);
export const ATTENDANCE_UNAVAILABLE_MESSAGE = "Fitur Absensi belum aktif. Hubungi Admin SITOU.";

/** Hak lama boleh disimpan kembali, tetapi tidak diubah saat modul nonaktif. */
export function changesUnavailableAttendanceGrants(assigned, requested, attendanceEnabled) {
  return (
    !attendanceEnabled &&
    requested.some(
      (grant) =>
        ATTENDANCE_MENU_KEYS.includes(grant.key) &&
        !assigned.some((existing) => existing.key === grant.key && existing.level === grant.level),
    )
  );
}
const change = z
  .object({
    moduleCode: moduleCodeSchema,
    isEnabled: z.boolean(),
    version: z.number().int().nonnegative(),
  })
  .strict();
export const moduleBatchSchema = z
  .object({
    organizationId: z.coerce.number().int().positive(),
    changes: z
      .array(change)
      .min(1)
      .max(2)
      .refine(
        (rows) => new Set(rows.map((row) => row.moduleCode)).size === rows.length,
        "Fitur tidak boleh berulang.",
      ),
  })
  .strict();
