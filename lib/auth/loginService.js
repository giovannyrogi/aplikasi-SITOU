import bcrypt from "bcryptjs";
import { getDefaultRouteByRole } from "@/app/utils/defaultRouteByRole";
import { checkLoginRateLimit, clearLoginFailures, recordLoginFailure } from "./loginRateLimit";
import { findUserForLogin, recordSuccessfulLogin } from "./userRepository";
import { subscriptionAllowsAccess } from "@/lib/subscriptions/status.mjs";
import { getEmployeeAccessFailure, getInactiveAccountMessage } from "./accessPolicy.mjs";

const DUMMY_PASSWORD_HASH = "$2b$12$C6UzMDM.H6dfI/f/IKcEe.5Yh6QmKQvUXLEdR0J1zWlf0Jt5Q8F.e";

export class LoginError extends Error {
  constructor(code, message, status, details = {}) {
    super(message);
    this.name = "LoginError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export async function authenticateUser({ username, password, ipAddress, userAgent, requestId }) {
  const rateLimit = checkLoginRateLimit(ipAddress, username);
  if (!rateLimit.allowed) {
    throw new LoginError(
      "RATE_LIMITED",
      "Terlalu banyak percobaan login. Silakan coba kembali beberapa saat lagi.",
      429,
      { retryAfter: rateLimit.retryAfter },
    );
  }

  const user = await findUserForLogin(username);
  const passwordMatches = await bcrypt.compare(
    password,
    user?.password_hash || DUMMY_PASSWORD_HASH,
  );

  if (!user || !passwordMatches) {
    recordLoginFailure(ipAddress, username);
    throw new LoginError("INVALID_CREDENTIALS", "Username atau password tidak valid.", 401);
  }

  if (!user.is_active) {
    recordLoginFailure(ipAddress, username);
    throw new LoginError("ACCOUNT_INACTIVE", getInactiveAccountMessage(user), 403);
  }

  if (!user.role_code) {
    recordLoginFailure(ipAddress, username);
    throw new LoginError(
      "ROLE_INACTIVE",
      "Hak akses akun Anda belum aktif. Hubungi Admin organisasi Anda.",
      403,
    );
  }

  if (user.role_scope !== "platform") {
    if (!user.organization_is_active) {
      throw new LoginError(
        "ORGANIZATION_INACTIVE",
        "Organisasi Anda telah dinonaktifkan. Hubungi Admin SITOU.",
        403,
      );
    }
    const subscriptionStatus = user.organization_subscription_status || "no_subscription";
    if (subscriptionStatus === "scheduled")
      throw new LoginError(
        "ORGANIZATION_NOT_STARTED",
        "Masa berlaku organisasi Anda belum dimulai. Hubungi Admin SITOU.",
        403,
      );
    if (subscriptionStatus === "suspended")
      throw new LoginError(
        "SUBSCRIPTION_SUSPENDED",
        "Masa berlaku organisasi Anda sedang ditangguhkan. Hubungi Admin SITOU.",
        403,
      );
    if (subscriptionStatus === "cancelled")
      throw new LoginError(
        "SUBSCRIPTION_CANCELLED",
        "Masa berlaku organisasi Anda telah dibatalkan. Hubungi Admin SITOU.",
        403,
      );
    if (!subscriptionAllowsAccess(subscriptionStatus)) {
      throw new LoginError(
        "ORGANIZATION_EXPIRED",
        "Masa berlaku organisasi Anda telah berakhir. Hubungi Admin SITOU untuk melakukan perpanjangan.",
        403,
      );
    }
    if (!user.has_active_location_scope) {
      throw new LoginError(
        "LOCATION_SCOPE_INACTIVE",
        "Akses akun tidak tersedia karena seluruh lokasi yang terhubung telah dinonaktifkan atau tidak lagi operasional. Silakan hubungi Administrator SITOU untuk bantuan.",
        403,
      );
    }

    const employeeAccessFailure = getEmployeeAccessFailure(user);
    if (employeeAccessFailure) {
      throw new LoginError(employeeAccessFailure.code, employeeAccessFailure.message, 403);
    }
  }
  if (
    user.role_code === "superadmin" &&
    (user.role_scope !== "platform" || user.organization_id !== null)
  ) {
    throw new LoginError("ROLE_INACTIVE", "Konfigurasi role Superadmin tidak valid.", 403);
  }

  await recordSuccessfulLogin({ user, ipAddress, userAgent, requestId });
  clearLoginFailures(ipAddress, username);

  return {
    user: {
      id: String(user.id),
      username: user.username,
      display_name: user.display_name,
      identity_source: user.identity_source,
      contact_email: user.contact_email,
      whatsapp: user.whatsapp,
      credential_version: user.credential_version,
      role_code: user.role_code,
      role_assignment_id: user.role_assignment_id ? String(user.role_assignment_id) : null,
      location_scope_mode: user.location_scope_mode || "all",
      organization_id: user.organization_id === null ? null : String(user.organization_id),
      organization_name: user.organization_name || null,
      organization_subscription_ends_on: user.organization_subscription_ends_on || null,
      organization_subscription_grace_ends_on: user.organization_subscription_grace_ends_on || null,
      organization_subscription_status: user.organization_subscription_status || null,
    },
    redirectTo: getDefaultRouteByRole(user.role_code),
  };
}
