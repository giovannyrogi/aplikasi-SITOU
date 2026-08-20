import bcrypt from "bcryptjs";
import { getDefaultRouteByRole } from "@/app/utils/defaultRouteByRole";
import { checkLoginRateLimit, clearLoginFailures, recordLoginFailure } from "./loginRateLimit";
import { findUserForLogin, recordSuccessfulLogin } from "./userRepository";

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
    throw new LoginError("ACCOUNT_INACTIVE", "Akun tidak aktif. Hubungi administrator.", 403);
  }

  if (!user.role_code) {
    recordLoginFailure(ipAddress, username);
    throw new LoginError("ROLE_INACTIVE", "Akun belum memiliki role aktif.", 403);
  }

  if (user.role_scope !== "platform") {
    const dateParts = new Intl.DateTimeFormat("en-CA", {
      timeZone: user.organization_timezone || "Asia/Makassar",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const part = (type) => dateParts.find((item) => item.type === type)?.value;
    const localDate = `${part("year")}-${part("month")}-${part("day")}`;

    if (!user.organization_is_active) {
      throw new LoginError(
        "ORGANIZATION_INACTIVE",
        "Organisasi sedang dinonaktifkan. Hubungi Superadmin.",
        403,
      );
    }
    if (localDate < String(user.organization_active_from)) {
      throw new LoginError("ORGANIZATION_NOT_STARTED", "Masa akses organisasi belum dimulai.", 403);
    }
    if (localDate > String(user.organization_active_until)) {
      throw new LoginError(
        "ORGANIZATION_EXPIRED",
        "Masa akses organisasi telah berakhir. Hubungi Superadmin.",
        403,
      );
    }
    if (user.role_code === "hrd" && !user.has_active_location_scope) {
      throw new LoginError(
        "LOCATION_SCOPE_INACTIVE",
        "Akun belum memiliki akses lokasi aktif.",
        403,
      );
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
      full_name: user.full_name,
      role_code: user.role_code,
      organization_id: user.organization_id === null ? null : String(user.organization_id),
      organization_name: user.organization_name || null,
      organization_active_until: user.organization_active_until || null,
    },
    redirectTo: getDefaultRouteByRole(user.role_code),
  };
}
