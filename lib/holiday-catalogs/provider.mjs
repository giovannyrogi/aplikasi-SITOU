import { createHash } from "node:crypto";
import { z } from "zod";
import { catalogDay, catalogMutation, catalogYear } from "./schemas.mjs";

export const HOLIDAY_PROVIDER = "Indonesian Holidays";
export const HOLIDAY_PROVIDER_ORIGIN = "https://indonesian-holidays.ahrulsyamil.com";
const MAX_BYTES = 256 * 1024;
export class HolidayProviderError extends Error {
  constructor(code, message, status = 502) {
    super(message);
    this.code = code;
    this.status = status;
  }
}
const unavailable = (year) =>
  new HolidayProviderError(
    "HOLIDAY_YEAR_UNAVAILABLE",
    `Penyedia belum menyediakan katalog ${year}. Isian dan katalog tersimpan tetap dipertahankan.`,
    422,
  );
const invalid = () =>
  new HolidayProviderError(
    "HOLIDAY_SOURCE_INVALID",
    "Data sumber belum dapat digunakan. Periksa sumber resmi atau coba lagi nanti.",
  );
const envelope = z.object({
  meta: z.object({
    year: z.number().int(),
    count: z.number().int().nonnegative(),
    sources: z
      .array(
        z.object({
          year: z.number().int(),
          type: z.string(),
          number: z.string(),
          url: z.string(),
          issued_date: z.string().optional(),
        }),
      )
      .max(32),
  }),
  data: z
    .array(
      z.object({
        date: z.string(),
        name: z.string(),
        type: z.enum(["national_holiday", "joint_leave"]),
        is_national: z.boolean().optional(),
      }),
    )
    .max(366),
});
/** Reject unknown categories, incomplete years and duplicate dates instead of guessing or dropping data. */
export function normalizeProviderYear(raw, year, fetchedAt = new Date().toISOString()) {
  const parsed = envelope.safeParse(raw);
  if (!parsed.success) throw invalid();
  const { meta, data } = parsed.data;
  if (meta.year !== year || meta.count !== data.length) throw invalid();
  if (!data.length) throw unavailable(year);
  const sources = meta.sources
    .filter((s) => s.year === year && s.type === "skb")
    .sort((a, b) => (b.issued_date || "").localeCompare(a.issued_date || ""));
  if (!sources.length) throw invalid();
  const days = data
    .map((d) => {
      if (d.is_national !== undefined && d.is_national !== (d.type === "national_holiday"))
        throw invalid();
      return {
        date: d.date,
        name: d.name.trim(),
        category: d.type === "national_holiday" ? "national" : "joint_leave",
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  const checked = catalogMutation.safeParse({
    operation: "save",
    requestKey: "00000000-0000-4000-8000-000000000001",
    year,
    decisionNumber: sources[0].number,
    sourceUrl: sources[0].url,
    days,
  });
  if (!checked.success || days.some((d) => !catalogDay.safeParse(d).success)) throw invalid();
  return {
    year,
    decisionNumber: checked.data.decisionNumber,
    sourceUrl: checked.data.sourceUrl,
    days,
    provider: HOLIDAY_PROVIDER,
    providerUrl: `${HOLIDAY_PROVIDER_ORIGIN}/holidays/${year}`,
    fetchedAt,
    digest: createHash("sha256")
      .update(
        JSON.stringify({
          year,
          decisionNumber: checked.data.decisionNumber,
          sourceUrl: checked.data.sourceUrl,
          days,
        }),
      )
      .digest("hex"),
  };
}
export async function fetchProviderYear(year, { fetchImpl = fetch, timeoutMs = 15000 } = {}) {
  year = catalogYear.parse(year);
  try {
    const response = await fetchImpl(`${HOLIDAY_PROVIDER_ORIGIN}/holidays/${year}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (response.status === 404) throw unavailable(year);
    if (!response.ok)
      throw new HolidayProviderError(
        "HOLIDAY_SOURCE_UNAVAILABLE",
        "Penyedia hari libur belum dapat dihubungi. Coba lagi nanti.",
        503,
      );
    if (!response.headers.get("content-type")?.toLowerCase().includes("application/json"))
      throw invalid();
    const declared = Number(response.headers.get("content-length") || 0);
    if (!Number.isFinite(declared) || declared < 0 || declared > MAX_BYTES || !response.body)
      throw invalid();
    const reader = response.body.getReader(),
      chunks = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_BYTES) throw invalid();
        chunks.push(value);
      }
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
    const bytes = Buffer.concat(chunks);
    let raw;
    try {
      raw = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    } catch {
      throw invalid();
    }
    return normalizeProviderYear(raw, year);
  } catch (error) {
    if (error instanceof HolidayProviderError) throw error;
    throw new HolidayProviderError(
      "HOLIDAY_SOURCE_UNAVAILABLE",
      "Penyedia hari libur belum dapat dihubungi. Coba lagi nanti.",
      503,
    );
  }
}
