import { z } from "zod";

export const INDONESIAN_NATIONAL_ID_LENGTH = 16;
export const INDONESIAN_NATIONAL_ID_MESSAGE = "NIK harus terdiri dari tepat 16 digit.";

/** Menyimpan NIK dalam bentuk digit canonical tanpa spasi atau tanda pemisah. */
export function normalizeIndonesianNationalId(value) {
  if (value === null || value === undefined || value === "") return null;
  return String(value).replace(/\D/g, "") || null;
}

/** Memeriksa NIK Indonesia tanpa menerima representasi yang ambigu. */
export function isValidIndonesianNationalId(value) {
  return new RegExp(`^\\d{${INDONESIAN_NATIONAL_ID_LENGTH}}$`).test(value || "");
}

/** Schema NIK opsional menormalkan input sebelum menerapkan panjang wajib. */
export const optionalIndonesianNationalIdSchema = z.preprocess(
  normalizeIndonesianNationalId,
  z
    .union([z.string().regex(/^\d{16}$/, INDONESIAN_NATIONAL_ID_MESSAGE), z.null()])
    .optional()
    .default(null),
);

/** Aturan AntD terpusat menjaga seluruh input NIK mengikuti kontrak yang sama. */
export function getIndonesianNationalIdFormRules({ required = false } = {}) {
  return [
    {
      validator: async (_, value) => {
        const normalized = normalizeIndonesianNationalId(value);
        if (!normalized && !required) return;
        if (!normalized && required) throw new Error("NIK wajib diisi.");
        if (!isValidIndonesianNationalId(normalized))
          throw new Error(INDONESIAN_NATIONAL_ID_MESSAGE);
      },
    },
  ];
}
