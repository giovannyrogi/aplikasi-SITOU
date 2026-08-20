/**
 * Helper kecil untuk validasi API route.
 * Tujuannya membuat pola response, validasi id, validasi string, dan error
 * handling konsisten di semua endpoint master data yang akan di-hardening.
 */

export const jsonResponse = (payload, status = 200) => Response.json(payload, { status });

export const failResponse = (message, status = 400) =>
  jsonResponse({ success: false, message }, status);

export const parsePositiveInteger = (value, label = "ID") => {
  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    return {
      value: null,
      error: `${label} tidak valid.`,
    };
  }

  return { value: parsedValue, error: null };
};

export const normalizeRequiredString = (
  value,
  label,
  { max = 120, pattern, patternMessage } = {},
) => {
  if (typeof value !== "string" && typeof value !== "number") {
    return { value: "", error: `${label} wajib diisi.` };
  }

  const normalizedValue = String(value).trim();

  if (!normalizedValue) {
    return { value: "", error: `${label} wajib diisi.` };
  }

  if (normalizedValue.length > max) {
    return {
      value: normalizedValue,
      error: `${label} maksimal ${max} karakter.`,
    };
  }

  if (pattern && !pattern.test(normalizedValue)) {
    return {
      value: normalizedValue,
      error: patternMessage || `${label} memiliki format yang tidak valid.`,
    };
  }

  return { value: normalizedValue, error: null };
};

export const normalizeOptionalString = (value, label = "Nilai", max = 150) => {
  const normalizedValue = String(value || "").trim();

  if (normalizedValue.length > max) {
    return {
      value: normalizedValue,
      error: `${label} maksimal ${max} karakter.`,
    };
  }

  return { value: normalizedValue || null, error: null };
};

export const parseNonNegativeNumber = (value, label = "Nilai") => {
  const normalizedValue = String(value ?? "")
    .replace(",", ".")
    .trim();
  const parsedValue = Number(normalizedValue);

  if (!Number.isFinite(parsedValue) || parsedValue < 0) {
    return { value: null, error: `${label} harus berupa angka 0 atau lebih.` };
  }

  return { value: parsedValue, error: null };
};

export const parsePositiveNumber = (value, label = "Nilai") => {
  const result = parseNonNegativeNumber(value, label);
  if (result.error) return result;

  if (result.value <= 0) {
    return { value: null, error: `${label} harus lebih besar dari 0.` };
  }

  return result;
};

export const handleApiError = (context, error, message = "Terjadi kesalahan server.") => {
  console.error(context, error);
  return failResponse(message, 500);
};
