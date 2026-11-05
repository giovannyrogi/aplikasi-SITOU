import { z } from "zod";
import { dateValid } from "../work-schedules/rules.mjs";
const id = z.string().regex(/^[1-9]\d{0,17}$/);
export const catalogYear = z.coerce.number().int().min(2000).max(2200);
export const catalogSourceRequest = z
  .object({ year: catalogYear, id: id.optional(), revisionOf: id.optional() })
  .strict();
export const catalogDay = z
  .object({
    date: z.string().refine(dateValid, "Tanggal tidak valid."),
    name: z.string().trim().min(1).max(100),
    category: z.enum(["national", "joint_leave"]),
  })
  .strict();
export const catalogMutation = z
  .object({
    operation: z.enum(["save", "publish", "edit_published"]),
    requestKey: z.string().uuid(),
    id: id.optional(),
    revisionOf: id.optional(),
    version: z.number().int().positive().optional(),
    pdfImportId: z.string().uuid().optional(),
    pdfReviewed: z.boolean().optional(),
    year: catalogYear,
    decisionNumber: z.string().trim().min(1).max(200),
    sourceUrl: z
      .string()
      .max(1000)
      .url()
      .refine((v) => {
        if (!URL.canParse(v)) return false;
        const u = new URL(v);
        return (
          u.protocol === "https:" &&
          u.hostname.endsWith(".go.id") &&
          !u.username &&
          !u.password &&
          !u.port
        );
      }, "Gunakan tautan HTTPS sumber resmi pemerintah.")
      .or(z.literal("")),
    days: z.array(catalogDay).min(1).max(366),
  })
  .strict()
  .superRefine((v, c) => {
    if (!v.sourceUrl && !v.pdfImportId)
      c.addIssue({
        code: "custom",
        path: ["sourceUrl"],
        message: "Isi tautan sumber resmi atau unggah PDF SKB.",
      });
    if (v.pdfImportId && v.pdfReviewed !== true)
      c.addIssue({
        code: "custom",
        path: ["pdfReviewed"],
        message: "Cocokkan hasil dengan PDF dan konfirmasi peninjauan.",
      });
    if (v.days.some((d) => Number(d.date.slice(0, 4)) !== v.year))
      c.addIssue({
        code: "custom",
        path: ["days"],
        message: "Tanggal harus berada pada tahun katalog.",
      });
    if (new Set(v.days.map((d) => d.date)).size !== v.days.length)
      c.addIssue({ code: "custom", path: ["days"], message: "Tanggal tidak boleh berulang." });
    if (v.operation === "edit_published" && (!v.id || !v.version || v.revisionOf))
      c.addIssue({
        code: "custom",
        path: ["id"],
        message: "Muat ulang katalog terbit sebelum mengedit.",
      });
    if (v.operation === "publish" && (!v.id || !v.version))
      c.addIssue({ code: "custom", path: ["id"], message: "Simpan draft sebelum menerbitkan." });
  });
