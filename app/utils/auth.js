import { cookies } from "next/headers";
import { findActiveSessionUser } from "@/lib/auth/userRepository";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";
import { resolveOrganizationScope } from "@/lib/auth/organizationScope.mjs";

export async function getAuthenticatedUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await verifySessionToken(token);
  if (!session) return null;

  const user = await findActiveSessionUser({
    userId: session.userId,
    roleCode: session.roleCode,
    organizationId: session.organizationId,
  });
  return user ? { ...user, session_expires_at: Number(session.expiresAt) } : null;
}

export function unauthorizedResponse() {
  return Response.json(
    {
      success: false,
      code: "UNAUTHENTICATED",
      message: "Sesi login tidak valid. Silakan login ulang.",
    },
    { status: 401 },
  );
}

export function forbiddenResponse(message = "Anda tidak memiliki akses untuk aksi ini.") {
  return Response.json({ success: false, code: "FORBIDDEN", message }, { status: 403 });
}

export async function requireAuthenticatedUser() {
  const user = await getAuthenticatedUser();
  return user ? { user, response: null } : { user: null, response: unauthorizedResponse() };
}

export async function requireRole(allowedRoleCodes = []) {
  const { user, response } = await requireAuthenticatedUser();
  if (response) return { user: null, response };

  if (!allowedRoleCodes.includes(user.role_code)) {
    return { user, response: forbiddenResponse() };
  }

  return { user, response: null };
}

/**
 * Mengunci akses organisasi dari session. Superadmin boleh memakai organisasi request,
 * sedangkan HRD selalu dibatasi ke organisasi tempat rolenya terdaftar.
 */
export function resolveOrganizationAccess(
  user,
  requestedOrganizationId,
  { optional = false } = {},
) {
  const scope = resolveOrganizationScope({
    roleCode: user.role_code,
    sessionOrganizationId: user.organization_id,
    requestedOrganizationId,
    optional,
  });
  if (scope.error === "ORGANIZATION_REQUIRED") {
    return {
      organizationId: null,
      response: Response.json(
        {
          success: false,
          code: "ORGANIZATION_REQUIRED",
          message: "Organisasi wajib dipilih.",
        },
        { status: 400 },
      ),
    };
  }
  if (scope.error) {
    return {
      organizationId: null,
      response: forbiddenResponse("Anda tidak memiliki akses ke organisasi tersebut."),
    };
  }
  return { organizationId: scope.organizationId, response: null };
}
