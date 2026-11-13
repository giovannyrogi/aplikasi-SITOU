import { NextResponse } from "next/server";
import { getDefaultRouteByRole } from "@/app/utils/defaultRouteByRole";
import { getAllowedRolesForPath, isPublicPath } from "@/app/utils/protectedRoutes";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";

const buildContentSecurityPolicy = (nonce, googleMaps) => {
  const production = process.env.NODE_ENV === "production";
  const developmentEval = production ? "" : " 'unsafe-eval'";
  const upgrade = production ? "; upgrade-insecure-requests" : "";
  const mapsHosts = googleMaps
    ? " https://maps.googleapis.com https://maps.gstatic.com https://maps.google.com https://www.google.com"
    : "";
  const mapStyles = googleMaps ? " https://fonts.googleapis.com" : "";
  const mapFonts = googleMaps ? " https://fonts.gstatic.com" : "";
  const mapWorkers = googleMaps ? "; worker-src 'self' blob:" : "";
  return `default-src 'self'; script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${developmentEval}; style-src 'self' 'unsafe-inline'${mapStyles}; img-src 'self' data: blob: https://tile.openstreetmap.org${mapsHosts}; font-src 'self' data:${mapFonts}; connect-src 'self'${mapsHosts}; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'${mapWorkers}${upgrade}`;
};

const securityHeaders = (response, contentSecurityPolicy) => {
  response.headers.set("Content-Security-Policy", contentSecurityPolicy);
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
  // The document's CSP also applies when entering Rekap Absensi through client navigation.
  const googleMaps =
    session &&
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY &&
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID &&
    !pathname.startsWith("/api/");
  const contentSecurityPolicy = buildContentSecurityPolicy(nonce, googleMaps);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  // Header konteks selalu ditimpa server; browser tidak dapat memilih pemilik izin.
  requestHeaders.set("x-sitou-path", pathname);
  requestHeaders.set("x-sitou-method", request.method);
  // Next.js reads the request CSP to attach this nonce to its generated scripts.
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);
  const next = () => NextResponse.next({ request: { headers: requestHeaders } });
  const redirect = (target) => NextResponse.redirect(new URL(target, request.url));

  if (pathname.startsWith("/api/")) return securityHeaders(next(), contentSecurityPolicy);

  if (pathname === "/")
    return securityHeaders(
      redirect(session ? getDefaultRouteByRole(session.roleCode) : "/login"),
      contentSecurityPolicy,
    );

  if (isPublicPath(pathname)) {
    if (pathname === "/login" && session)
      return securityHeaders(
        redirect(getDefaultRouteByRole(session.roleCode)),
        contentSecurityPolicy,
      );
    const response = token && !session ? clearSessionCookie(next()) : next();
    return securityHeaders(response, contentSecurityPolicy);
  }

  if (!session)
    return securityHeaders(clearSessionCookie(redirect("/login")), contentSecurityPolicy);

  const allowedRoles = getAllowedRolesForPath(pathname);
  if (!allowedRoles.includes(session.roleCode))
    return securityHeaders(
      redirect(getDefaultRouteByRole(session.roleCode)),
      contentSecurityPolicy,
    );

  return securityHeaders(next(), contentSecurityPolicy);
}

export const config = {
  matcher: [
    "/api/:path*",
    "/((?!_next|api|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|css|js|doc|docx|pdf)).*)",
  ],
};
