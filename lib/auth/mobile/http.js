import { isIP } from "node:net";
import { z } from "zod";
import {
  errorResponse,
  getRequestId,
  readBoundedRequestText,
  validateRequestOrigin,
} from "@/lib/api/routeHelpers";
import { LoginError } from "../loginError";
import { loginMobile, logoutMobile, requireMobileUser } from "./service";

const schema = z.strictObject({
  username: z
    .string({ error: "Nama pengguna harus berupa teks." })
    .trim()
    .min(1, "Isi nama pengguna.")
    .max(100, "Nama pengguna maksimal 100 karakter.")
    .regex(/^[a-zA-Z0-9._-]+$/, "Format nama pengguna tidak sesuai."),
  password: z
    .string({ error: "Kata sandi harus berupa teks." })
    .min(1, "Isi kata sandi.")
    .refine((value) => Buffer.byteLength(value, "utf8") <= 72, "Kata sandi maksimal 72 byte."),
});
const responseHeaders = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};

/** Adapter HTTP tipis: origin existing tetap dipertahankan, native tidak memakai cookie. */
export async function handleMobileAuth(request, operation) {
  const requestId = getRequestId(request);
  const invalidOrigin = validateRequestOrigin(request, requestId);
  if (invalidOrigin) return invalidOrigin;
  const forwarded =
    process.env.TRUST_PROXY === "1"
      ? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        request.headers.get("x-real-ip")
      : null;
  const metadata = {
    requestId,
    ipAddress: forwarded && isIP(forwarded) ? forwarded : "127.0.0.1",
    userAgent: request.headers.get("user-agent")?.slice(0, 500) || null,
  };
  try {
    let data;
    if (operation === "login") {
      if (
        request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !==
        "application/json"
      )
        return errorResponse("UNSUPPORTED_MEDIA_TYPE", "Format data tidak sesuai.", 415, requestId);
      let body;
      try {
        body = JSON.parse(await readBoundedRequestText(request, 8192));
      } catch (error) {
        if (error.code === "PAYLOAD_TOO_LARGE")
          return errorResponse(error.code, "Ukuran data terlalu besar.", 413, requestId);
        return errorResponse("INVALID_JSON", "Format data tidak sesuai.", 400, requestId);
      }
      const parsed = schema.safeParse(body);
      if (!parsed.success) {
        const fieldErrors = {};
        for (const issue of parsed.error.issues) {
          const field = issue.path[0] || "form";
          fieldErrors[field] ||= field === "form" ? "Data login tidak sesuai." : issue.message;
        }
        return errorResponse(
          "VALIDATION_ERROR",
          Object.values(fieldErrors)[0],
          400,
          requestId,
          fieldErrors,
        );
      }
      data = await loginMobile(parsed.data, metadata);
    } else if (operation === "me") data = await requireMobileUser(request);
    else {
      await logoutMobile(request, metadata);
      data = null;
    }
    return Response.json(
      {
        success: true,
        code: operation === "login" ? "LOGIN_SUCCESS" : "SUCCESS",
        message:
          operation === "login"
            ? "Berhasil masuk."
            : operation === "logout"
              ? "Berhasil keluar."
              : "Berhasil.",
        requestId,
        data,
      },
      { headers: responseHeaders },
    );
  } catch (error) {
    if (error instanceof LoginError) {
      if (operation === "login")
        console.warn("[auth.mobile.rejected]", {
          requestId,
          code: error.code,
          ipAddress: metadata.ipAddress,
        });
      return errorResponse(
        error.code,
        error.code === "RATE_LIMITED"
          ? "Terlalu banyak percobaan. Coba lagi nanti."
          : error.message,
        error.status,
        requestId,
        error.details.fieldErrors,
        error.details.retryAfter ? { "Retry-After": String(error.details.retryAfter) } : undefined,
      );
    }
    // Log hanya kategori dan request ID, tanpa pesan SQL/credential/body.
    console.error("[auth.mobile]", { requestId, code: error.code || "INTERNAL_ERROR" });
    return errorResponse("INTERNAL_ERROR", "Terjadi gangguan. Coba lagi.", 500, requestId);
  }
}
