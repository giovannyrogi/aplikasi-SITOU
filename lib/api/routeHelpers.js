import { createHash, randomUUID } from "node:crypto";
import pool from "../dbConfig.js";
import { parseMultipartToPrivateTemp } from "./multipart.js";

const MAX_MUTATION_BYTES = 64 * 1024;
const MAX_JSON_BYTES = 256 * 1024;
const WINDOW_MS = 15 * 60 * 1000;
const MAX_MUTATIONS = 120;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};

export const successResponse = (
  data,
  { code = "SUCCESS", message = "Berhasil.", status = 200, pagination } = {},
) =>
  Response.json(
    { success: true, code, message, data, ...(pagination ? { pagination } : {}) },
    { status, headers: PRIVATE_HEADERS },
  );

export const errorResponse = (code, message, status, requestId, fieldErrors, extraHeaders) =>
  Response.json(
    { success: false, code, message, requestId, ...(fieldErrors ? { fieldErrors } : {}) },
    { status, headers: { ...PRIVATE_HEADERS, ...extraHeaders } },
  );

export const getRequestId = (request) => {
  const supplied = String(request.headers.get("x-request-id") || "").trim();
  return UUID_PATTERN.test(supplied) ? supplied : randomUUID();
};

const firstForwardedValue = (value) => value?.split(",")[0]?.trim() || null;
const trustProxy = () => process.env.TRUST_PROXY === "1";

const getClientIp = (request) => {
  if (trustProxy())
    return (
      firstForwardedValue(request.headers.get("x-forwarded-for")) ||
      request.headers.get("x-real-ip") ||
      "unknown"
    );
  return "direct";
};

const normalizeOrigin = (value) => {
  if (!value) return null;
  try {
    return new URL(value).origin.toLowerCase();
  } catch {
    return null;
  }
};

export const getTrustedRequestOrigins = (request) => {
  const origins = new Set();
  const addOrigin = (value) => {
    const normalized = normalizeOrigin(value);
    if (normalized) origins.add(normalized);
  };
  for (const configuredOrigin of String(process.env.APP_ORIGIN || "").split(","))
    addOrigin(configuredOrigin.trim());

  if (process.env.NODE_ENV !== "production") addOrigin(new URL(request.url).origin);
  if (trustProxy()) {
    const forwardedProto = firstForwardedValue(request.headers.get("x-forwarded-proto"));
    const forwardedHost = firstForwardedValue(request.headers.get("x-forwarded-host"));
    if (forwardedProto && forwardedHost) addOrigin(forwardedProto + "://" + forwardedHost);
  }
  return origins;
};

export const validateRequestOrigin = (request, requestId) => {
  const origin = normalizeOrigin(request.headers.get("origin"));
  const trusted = getTrustedRequestOrigins(request);
  if (process.env.NODE_ENV === "production" && trusted.size === 0)
    return errorResponse(
      "ORIGIN_CONFIGURATION_INVALID",
      "Konfigurasi origin aplikasi belum tersedia.",
      503,
      requestId,
    );
  if (origin && !trusted.has(origin))
    return errorResponse("INVALID_ORIGIN", "Asal permintaan tidak diizinkan.", 403, requestId);
  return null;
};

async function consumePersistentRateLimit(request, actorId, options = {}) {
  const now = Date.now();
  const windowMs = options.windowMs || WINDOW_MS;
  const maxRequests = options.maxRequests || MAX_MUTATIONS;
  const windowStartedAt = new Date(Math.floor(now / windowMs) * windowMs);
  const expiresAt = new Date(windowStartedAt.getTime() + windowMs * 2);
  const action = String(options.rateLimitAction || new URL(request.url).pathname).slice(0, 80);
  const identifier = [actorId || "anonymous", getClientIp(request), action].join(":");
  const key = createHash("sha256").update(identifier).digest("hex");
  const result = await pool.query(
    `INSERT INTO security_rate_limit_buckets
      (action,bucket_key,window_started_at,request_count,expires_at)
     VALUES($1,$2,$3,1,$4)
     ON CONFLICT(action,bucket_key,window_started_at)
     DO UPDATE SET request_count=security_rate_limit_buckets.request_count+1,
       expires_at=GREATEST(security_rate_limit_buckets.expires_at,EXCLUDED.expires_at)
     RETURNING request_count`,
    [action, key, windowStartedAt, expiresAt],
  );
  return {
    allowed: Number(result.rows[0].request_count) <= maxRequests,
    retryAfter: Math.max(1, Math.ceil((windowStartedAt.getTime() + windowMs - now) / 1000)),
  };
}

export const validateMutationRequest = async (request, actorId, requestId, options = {}) => {
  const invalidOrigin = validateRequestOrigin(request, requestId);
  if (invalidOrigin) return invalidOrigin;

  const contentLengthHeader = request.headers.get("content-length");
  const contentLength = contentLengthHeader ? Number(contentLengthHeader) : 0;
  const maxBytes = options.maxBytes || MAX_MUTATION_BYTES;
  if (!Number.isFinite(contentLength) || contentLength < 0 || contentLength > maxBytes)
    return errorResponse("PAYLOAD_TOO_LARGE", "Ukuran data terlalu besar.", 413, requestId);

  try {
    const limit = await consumePersistentRateLimit(request, actorId, options);
    if (!limit.allowed)
      return errorResponse(
        "RATE_LIMITED",
        options.rateLimitMessage || "Terlalu banyak perubahan data. Coba kembali nanti.",
        429,
        requestId,
        null,
        { "Retry-After": String(limit.retryAfter) },
      );
  } catch (error) {
    console.error("[security.rate_limit]", { requestId, error: error.message });
    return errorResponse(
      "RATE_LIMIT_UNAVAILABLE",
      "Pemeriksaan batas permintaan tidak tersedia. Coba kembali nanti.",
      503,
      requestId,
    );
  }
  return null;
};

export async function readBoundedRequestText(request, maxBytes) {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let result = "";
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > maxBytes)
        throw new ServiceError("PAYLOAD_TOO_LARGE", "Ukuran data terlalu besar.", 413);
      result += decoder.decode(chunk.value, { stream: true });
    }
    result += decoder.decode();
    return result;
  } finally {
    reader.releaseLock();
  }
}

export const readJson = async (request, schema, requestId) => {
  try {
    const parsed = JSON.parse(await readBoundedRequestText(request, MAX_JSON_BYTES));
    const result = schema.safeParse(parsed);
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
        result.error.issues[0]?.message || "Periksa kembali data yang diisi.",
        400,
        requestId,
        fieldErrors,
      ),
    };
  } catch (error) {
    if (error instanceof ServiceError)
      return {
        data: null,
        response: errorResponse(error.code, error.message, error.status, requestId),
      };
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

export const readMultipartJson = async (
  request,
  schema,
  requestId,
  { payloadField = "payload", fileField = "file", allowedFields } = {},
) => {
  let form = null;
  try {
    form = await parseMultipartToPrivateTemp(request);
    const allowed = new Set(allowedFields || [payloadField, fileField]);
    for (const key of form.keys())
      if (!allowed.has(key)) {
        await form.cleanup();
        return {
          data: null,
          file: null,
          form,
          response: errorResponse(
            "MULTIPART_FIELD_INVALID",
            `Bagian formulir "${key}" tidak diizinkan.`,
            400,
            requestId,
          ),
        };
      }
    const rawPayload = form.get(payloadField);
    if (typeof rawPayload !== "string" || Buffer.byteLength(rawPayload, "utf8") > MAX_JSON_BYTES) {
      await form.cleanup();
      return {
        data: null,
        file: null,
        form,
        response: errorResponse(
          "INVALID_MULTIPART_PAYLOAD",
          "Payload formulir tidak ditemukan atau terlalu besar.",
          400,
          requestId,
          {
            [payloadField]: "Payload formulir wajib diisi dan maksimal 256 KB.",
          },
        ),
      };
    }
    const result = schema.safeParse(JSON.parse(rawPayload));
    if (!result.success) {
      const fieldErrors = {};
      for (const issue of result.error.issues) {
        const field = issue.path.join(".") || "form";
        if (!fieldErrors[field]) fieldErrors[field] = issue.message;
      }
      await form.cleanup();
      return {
        data: null,
        file: null,
        form: null,
        response: errorResponse(
          "VALIDATION_ERROR",
          result.error.issues[0]?.message || "Periksa kembali data yang diisi.",
          400,
          requestId,
          fieldErrors,
        ),
      };
    }
    const file = form.get(fileField);
    return {
      data: result.data,
      file: file && typeof file.arrayBuffer === "function" && file.size > 0 ? file : null,
      form,
      cleanup: form.cleanup,
      response: null,
    };
  } catch (error) {
    await form?.cleanup?.();
    if (error?.code && error?.status) {
      return {
        data: null,
        file: null,
        form: null,
        response: errorResponse(error.code, error.message, error.status, requestId),
      };
    }
    return {
      data: null,
      file: null,
      form: null,
      response: errorResponse(
        "INVALID_MULTIPART_PAYLOAD",
        "Formulir multipart tidak valid.",
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
  if (
    error instanceof ServiceError ||
    (error?.status &&
      ["MULTIPART_REQUIRED", "INVALID_MULTIPART_PAYLOAD", "PAYLOAD_TOO_LARGE"].includes(
        error?.code,
      ))
  )
    return errorResponse(error.code, error.message, error.status, requestId, error.fieldErrors);
  console.error(`[${context}] ${requestId}`, error);
  return errorResponse(
    "INTERNAL_ERROR",
    "Terjadi kesalahan server. Silakan coba kembali.",
    500,
    requestId,
  );
};
