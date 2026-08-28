import { randomUUID } from "node:crypto";

const MAX_MUTATION_BYTES = 64 * 1024;
const mutationBuckets = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_MUTATIONS = 120;

export const successResponse = (
  data,
  { code = "SUCCESS", message = "Berhasil.", status = 200, pagination } = {},
) =>
  Response.json(
    { success: true, code, message, data, ...(pagination ? { pagination } : {}) },
    { status },
  );

export const errorResponse = (code, message, status, requestId, fieldErrors) =>
  Response.json(
    { success: false, code, message, requestId, ...(fieldErrors ? { fieldErrors } : {}) },
    { status },
  );

export const getRequestId = (request) => request.headers.get("x-request-id") || randomUUID();

const getClientIp = (request) =>
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
  request.headers.get("x-real-ip") ||
  "127.0.0.1";

const firstForwardedValue = (value) => value?.split(",")[0]?.trim() || null;

const normalizeOrigin = (value) => {
  if (!value) return null;
  try {
    return new URL(value).origin.toLowerCase();
  } catch {
    return null;
  }
};

/** Origin publik dapat berasal dari URL request, reverse proxy tepercaya, atau APP_ORIGIN. */
export const getTrustedRequestOrigins = (request) => {
  const origins = new Set();
  const addOrigin = (value) => {
    const normalized = normalizeOrigin(value);
    if (normalized) origins.add(normalized);
  };
  addOrigin(new URL(request.url).origin);
  const forwardedProto = firstForwardedValue(request.headers.get("x-forwarded-proto"));
  const forwardedHost =
    firstForwardedValue(request.headers.get("x-forwarded-host")) ||
    firstForwardedValue(request.headers.get("host"));
  if (forwardedProto && forwardedHost) addOrigin(forwardedProto + "://" + forwardedHost);
  for (const configuredOrigin of String(process.env.APP_ORIGIN || "").split(",")) {
    addOrigin(configuredOrigin.trim());
  }
  return origins;
};

export const validateRequestOrigin = (request, requestId) => {
  const origin = normalizeOrigin(request.headers.get("origin"));
  if (origin && !getTrustedRequestOrigins(request).has(origin)) {
    return errorResponse("INVALID_ORIGIN", "Asal permintaan tidak diizinkan.", 403, requestId);
  }
  return null;
};

export const validateMutationRequest = (request, actorId, requestId, options = {}) => {
  const invalidOrigin = validateRequestOrigin(request, requestId);
  if (invalidOrigin) return invalidOrigin;

  const contentLength = Number(request.headers.get("content-length") || 0);
  const maxBytes = options.maxBytes || MAX_MUTATION_BYTES;
  if (contentLength > maxBytes) {
    return errorResponse("PAYLOAD_TOO_LARGE", "Ukuran data terlalu besar.", 413, requestId);
  }

  const now = Date.now();
  const key = `${actorId}:${getClientIp(request)}:${new URL(request.url).pathname}`;
  const bucket = mutationBuckets.get(key);
  if (!bucket || now - bucket.startedAt >= WINDOW_MS) {
    mutationBuckets.set(key, { count: 1, startedAt: now });
    return null;
  }

  bucket.count += 1;
  if (bucket.count > MAX_MUTATIONS) {
    return errorResponse(
      "RATE_LIMITED",
      "Terlalu banyak perubahan data. Coba kembali nanti.",
      429,
      requestId,
    );
  }

  return null;
};

export const readJson = async (request, schema, requestId) => {
  try {
    const result = schema.safeParse(await request.json());
    if (result.success) return { data: result.data, response: null };

    const fieldErrors = {};
    for (const issue of result.error.issues) {
      const field = issue.path.join(".") || "form";
      if (!fieldErrors[field]) fieldErrors[field] = issue.message;
    }
    return {
      data: null,
      response: errorResponse(
        "VALIDATION_ERROR",
        "Periksa kembali data yang diisi.",
        400,
        requestId,
        fieldErrors,
      ),
    };
  } catch {
    return {
      data: null,
      response: errorResponse(
        "INVALID_JSON",
        "Payload harus berupa JSON yang valid.",
        400,
        requestId,
      ),
    };
  }
};

export const parseListQuery = (searchParams) => ({
  search: String(searchParams.get("search") || "")
    .trim()
    .slice(0, 120),
  status: ["active", "inactive"].includes(searchParams.get("status"))
    ? searchParams.get("status")
    : "all",
  page: Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10) || 1),
  pageSize: Math.min(
    100,
    Math.max(10, Number.parseInt(searchParams.get("pageSize") || "10", 10) || 10),
  ),
});

export class ServiceError extends Error {
  constructor(code, message, status = 400, fieldErrors) {
    super(message);
    this.code = code;
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

export const handleRouteError = (context, error, requestId) => {
  if (error instanceof ServiceError) {
    return errorResponse(error.code, error.message, error.status, requestId, error.fieldErrors);
  }
  console.error(`[${context}] ${requestId}`, error);
  return errorResponse(
    "INTERNAL_ERROR",
    "Terjadi kesalahan server. Silakan coba kembali.",
    500,
    requestId,
  );
};
