import { isIP } from "node:net";
import { NextResponse } from "next/server";
import { normalizeRequiredString } from "@/app/utils/apiValidation";
import { authenticateUser, LoginError } from "@/lib/auth/loginService";
import { createSessionToken, getSessionTtlSeconds, SESSION_COOKIE_NAME } from "@/lib/auth/session";

export const runtime = "nodejs";

const USERNAME_PATTERN = /^[a-zA-Z0-9._-]+$/;

const getRequestIp = (request) => {
  const forwardedIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const candidate = forwardedIp || request.headers.get("x-real-ip")?.trim();
  return candidate && isIP(candidate) ? candidate : "127.0.0.1";
};

const validationError = (message) =>
  NextResponse.json({ success: false, code: "VALIDATION_ERROR", message }, { status: 400 });

export async function POST(request) {
  const requestId = crypto.randomUUID();

  try {
    const body = await request.json();
    const unknownFields = Object.keys(body || {}).filter(
      (field) => !["username", "password"].includes(field),
    );

    if (unknownFields.length > 0) {
      return validationError("Payload login hanya menerima username dan password.");
    }

    if (typeof body?.username !== "string" || typeof body?.password !== "string") {
      return validationError("Username dan password wajib berupa teks.");
    }

    const usernameResult = normalizeRequiredString(body?.username, "Username", {
      max: 100,
      pattern: USERNAME_PATTERN,
      patternMessage:
        "Username hanya boleh berisi huruf, angka, titik, garis bawah, dan tanda hubung.",
    });
    if (usernameResult.error) return validationError(usernameResult.error);

    const passwordResult = normalizeRequiredString(body?.password, "Password", { max: 72 });
    if (passwordResult.error) return validationError(passwordResult.error);

    if (new TextEncoder().encode(passwordResult.value).length > 72) {
      return validationError("Password maksimal 72 byte.");
    }

    const ipAddress = getRequestIp(request);
    const result = await authenticateUser({
      username: usernameResult.value,
      password: passwordResult.value,
      ipAddress,
      userAgent: request.headers.get("user-agent")?.slice(0, 500) || null,
      requestId,
    });

    const ttlSeconds = getSessionTtlSeconds();
    const expiresAt = Date.now() + ttlSeconds * 1000;
    const token = await createSessionToken({
      userId: result.user.id,
      roleCode: result.user.role_code,
      organizationId: result.user.organization_id,
      credentialVersion: result.user.credential_version,
      expiresAt,
    });

    const response = NextResponse.json({
      success: true,
      code: "LOGIN_SUCCESS",
      message: "Login berhasil.",
      data: result.user,
      redirectTo: result.redirectTo,
    });

    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: ttlSeconds,
      expires: new Date(expiresAt),
    });

    return response;
  } catch (error) {
    if (error instanceof LoginError) {
      const response = NextResponse.json(
        { success: false, code: error.code, message: error.message },
        { status: error.status },
      );

      if (error.details.retryAfter) {
        response.headers.set("Retry-After", String(error.details.retryAfter));
      }

      return response;
    }

    if (error instanceof SyntaxError) {
      return validationError("Payload login harus berupa JSON yang valid.");
    }

    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const developmentStack =
      process.env.NODE_ENV === "development" && error instanceof Error ? `\n${error.stack}` : "";
    console.error(`[auth.login] ${requestId} ${errorMessage}${developmentStack}`);
    return NextResponse.json(
      {
        success: false,
        code: "INTERNAL_ERROR",
        message: "Terjadi kesalahan server. Silakan coba kembali.",
      },
      { status: 500 },
    );
  }
}
