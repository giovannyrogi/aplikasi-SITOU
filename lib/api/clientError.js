const GENERIC_VALIDATION_MESSAGE = "Periksa kembali data yang diisi.";

const firstFieldError = (fieldErrors) =>
  Object.values(fieldErrors || {}).find((message) => typeof message === "string" && message.trim());

const withRequestReference = (message, requestId) =>
  requestId ? `${message} ID referensi: ${requestId}.` : message;

/** Error API terstruktur agar detail validasi tidak hilang di lapisan UI. */
export class ApiRequestError extends Error {
  constructor({ code, message, status, fieldErrors, requestId, cause }) {
    super(message, cause ? { cause } : undefined);
    this.name = "ApiRequestError";
    this.code = code || "REQUEST_FAILED";
    this.status = status || 0;
    this.fieldErrors = fieldErrors || {};
    this.requestId = requestId || null;
  }
}

/** Memilih pesan paling dapat ditindaklanjuti tanpa membuka detail internal server. */
export function resolveApiErrorMessage(body, status, fallbackMessage) {
  const validationMessage = firstFieldError(body?.fieldErrors);
  let message = body?.message || fallbackMessage || "Permintaan tidak dapat diproses.";

  if (validationMessage && (!body?.message || body.message === GENERIC_VALIDATION_MESSAGE)) {
    message = validationMessage;
  }

  if (status >= 500) {
    message = withRequestReference(
      body?.message || "Terjadi kesalahan server. Silakan coba kembali.",
      body?.requestId,
    );
  }

  return message;
}

/** Membaca respons JSON dengan fallback aman untuk respons kosong/non-JSON dan gangguan jaringan. */
export async function readApiResponse(response, fallbackMessage) {
  let body;
  try {
    body = await response.json();
  } catch (cause) {
    if (response.ok) return null;
    throw new ApiRequestError({
      code: "INVALID_RESPONSE",
      message:
        response.status === 401
          ? "Sesi Anda telah berakhir. Silakan masuk kembali."
          : fallbackMessage || "Respons server tidak dapat dibaca. Silakan coba kembali.",
      status: response.status,
      cause,
    });
  }

  if (!response.ok) {
    throw new ApiRequestError({
      code: body?.code,
      message: resolveApiErrorMessage(body, response.status, fallbackMessage),
      status: response.status,
      fieldErrors: body?.fieldErrors,
      requestId: body?.requestId,
    });
  }

  return body;
}

/** Menyamakan error fetch jaringan dengan error API agar notifikasi tetap jelas. */
export function normalizeRequestError(error, fallbackMessage) {
  if (error instanceof ApiRequestError) return error;
  return new ApiRequestError({
    code: "NETWORK_ERROR",
    message:
      error?.message && error.name !== "TypeError"
        ? error.message
        : fallbackMessage ||
          "Tidak dapat terhubung ke server. Periksa koneksi Anda lalu coba kembali.",
    cause: error,
  });
}

/** Menempelkan fieldErrors ke AntD Form dan mengarahkan pengguna ke masalah pertama. */
export function applyApiFieldErrors(form, error, options = {}) {
  const entries = Object.entries(error?.fieldErrors || {});
  if (!form || !entries.length) return false;

  const aliases = options.aliases || {};
  const normalized = entries.map(([path, message]) => ({
    name: aliases[path] || path.split("."),
    errors: [message],
  }));
  form.setFields(normalized);

  const first = normalized.find(({ name }) => {
    const path = Array.isArray(name) ? name.join(".") : String(name);
    return !options.nonFocusableFields?.includes(path);
  });
  if (first) {
    queueMicrotask(() => {
      try {
        form.scrollToField(first.name, { behavior: "smooth", block: "center" });
        form.focusField?.(first.name);
      } catch {
        // Field tersembunyi atau kontrol non-Form tetap dijelaskan melalui notifikasi.
      }
    });
  }
  return true;
}
