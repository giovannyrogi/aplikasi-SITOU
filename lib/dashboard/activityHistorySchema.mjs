import { z } from "zod";
/** Pilihan ukuran daftar riwayat dibatasi agar request tidak memuat seluruh audit. */
export const dashboardActivityHistoryQuerySchema = z
  .object({
    cursor: z.string().min(1).max(1500).optional(),
    pageSize: z.enum(["10", "20", "50"]).default("10"),
  })
  .strict();
