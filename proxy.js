import { NextResponse } from "next/server";
import { getDefaultRouteByRole } from "@/app/utils/defaultRouteByRole";
import { getAllowedRolesForPath, isPublicPath } from "@/app/utils/protectedRoutes";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";

const securityHeaders = (response, nonce) => {
  const upgrade = process.env.NODE_ENV === "production" ? "; upgrade-insecure-requests" : "";
  response.headers.set(
    "Content-Security-Policy",
    `default-src 'self'; script-src 'self' 'nonce-${nonce}' 'strict-dynamic'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'${upgrade}`,
  );
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  if (process.env.NODE_ENV === "production")
    response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  return response;
};

const clearSessionCookie = (response) => {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    expires: new Date(0),
    path: "/",
    sameSite: "strict",
  });
  return response;
};

export async function proxy(request) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  const next = () => NextResponse.next({ request: { headers: requestHeaders } });
  const redirect = (target) => NextResponse.redirect(new URL(target, request.url));

  if (pathname === "/")
    return securityHeaders(
      redirect(session ? getDefaultRouteByRole(session.roleCode) : "/login"),
      nonce,
    );

  if (isPublicPath(pathname)) {
    if (pathname === "/login" && session)
      return securityHeaders(redirect(getDefaultRouteByRole(session.roleCode)), nonce);
    const response = token && !session ? clearSessionCookie(next()) : next();
    return securityHeaders(response, nonce);
  }

  if (!session)
    return securityHeaders(clearSessionCookie(redirect("/login")), nonce);

  const allowedRoles = getAllowedRolesForPath(pathname);
  if (!allowedRoles.includes(session.roleCode))
    return securityHeaders(redirect(getDefaultRouteByRole(session.roleCode)), nonce);

  return securityHeaders(next(), nonce);
}

export const config = {
  matcher: [
    "/((?!_next|api|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|css|js|doc|docx|pdf)).*)",
  ],
};
