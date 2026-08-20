import { NextResponse } from "next/server";
import { getDefaultRouteByRole } from "@/app/utils/defaultRouteByRole";
import { getAllowedRolesForPath, isPublicPath } from "@/app/utils/protectedRoutes";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";

const clearSessionCookie = (response) => {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
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

  if (pathname === "/") {
    return NextResponse.redirect(
      new URL(session ? getDefaultRouteByRole(session.roleCode) : "/login", request.url),
    );
  }

  if (isPublicPath(pathname)) {
    if (pathname === "/login" && session) {
      return NextResponse.redirect(new URL(getDefaultRouteByRole(session.roleCode), request.url));
    }

    return token && !session ? clearSessionCookie(NextResponse.next()) : NextResponse.next();
  }

  if (!session) {
    return clearSessionCookie(NextResponse.redirect(new URL("/login", request.url)));
  }

  const allowedRoles = getAllowedRolesForPath(pathname);
  if (!allowedRoles.includes(session.roleCode)) {
    return NextResponse.redirect(new URL(getDefaultRouteByRole(session.roleCode), request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next|api|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|css|js|doc|docx|pdf)).*)",
  ],
};
