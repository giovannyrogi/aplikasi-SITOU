import { z } from "zod";

export const INDONESIAN_MOBILE_MESSAGE =
  "Nomor harus diawali 8 setelah +62 dan berisi 9 sampai 12 digit.";
export const INDONESIAN_MOBILE_PATTERN = /^\+628[1-9][0-9]{7,10}$/;

/** Menormalisasi format umum Indonesia menjadi E.164 tanpa spasi atau pemisah. */
export function normalizeIndonesianMobile(value) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const compact = String(value)
    .trim()
    .replace(/[\s().-]/g, "");
  let local = compact;
  if (local.startsWith("+62")) local = local.slice(3);
  else if (local.startsWith("62")) local = local.slice(2);
  else if (local.startsWith("0")) local = local.slice(1);
  return `+62${local}`;
}

/** Mengambil digit lokal untuk input yang sudah menampilkan prefix +62 secara visual. */
export function getIndonesianMobileLocalValue(value) {
  const canonical = normalizeIndonesianMobile(value);
  return canonical?.startsWith("+62") ? canonical.slice(3) : "";
}

/** Memastikan nomor kanonik cocok untuk tautan WhatsApp wa.me dan integrasi seluler. */
export function isValidIndonesianMobile(value) {
  const canonical = normalizeIndonesianMobile(value);
  return canonical === null || INDONESIAN_MOBILE_PATTERN.test(canonical);
}

/** Schema opsional mengubah input UI/import menjadi format E.164 sebelum service menyimpan. */
export const optionalIndonesianMobileSchema = z.preprocess(
  normalizeIndonesianMobile,
  z.union([z.string().regex(INDONESIAN_MOBILE_PATTERN, INDONESIAN_MOBILE_MESSAGE), z.null()]),
);

/** Schema wajib dipakai untuk kontak darurat yang harus dapat dihubungi. */
export const requiredIndonesianMobileSchema = z.preprocess(
  normalizeIndonesianMobile,
  z.string().regex(INDONESIAN_MOBILE_PATTERN, INDONESIAN_MOBILE_MESSAGE),
);

/** Rule AntD memakai validator domain yang sama dengan schema backend. */
export function getIndonesianMobileFormRules({ required = false } = {}) {
  return [
    ...(required ? [{ required: true, message: "Nomor wajib diisi." }] : []),
    {
      validator: (_, value) =>
        !value || isValidIndonesianMobile(value)
          ? Promise.resolve()
          : Promise.reject(new Error(INDONESIAN_MOBILE_MESSAGE)),
    },
  ];
}
