import { NextResponse } from "next/server";
import { getRequestId, validateRequestOrigin } from "@/lib/api/routeHelpers";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

export async function POST(request) {
  const requestId = getRequestId(request);
  const invalidOrigin = validateRequestOrigin(request, requestId);
  if (invalidOrigin) return invalidOrigin;
  const response = NextResponse.json(
    { success: true, code: "LOGOUT_SUCCESS", message: "Logout berhasil." },
    { headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } },
  );
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    expires: new Date(0),
    maxAge: 0,
  });
  return response;
}
