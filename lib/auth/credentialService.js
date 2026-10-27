import bcrypt from "bcryptjs";
import { checkLoginRateLimit, recordLoginFailure } from "./loginRateLimit";
import { findUserForLogin } from "./userRepository";
import { LoginError } from "./loginError";

const DUMMY_PASSWORD_HASH = "$2b$12$C6UzMDM.H6dfI/f/IKcEe.5Yh6QmKQvUXLEdR0J1zWlf0Jt5Q8F.e";

/** Verifikasi bersama menjaga bucket gagal web/mobile dan dummy bcrypt yang sama. */
export async function verifyLoginCredentials(
  { username, password, ipAddress },
  { findUser = findUserForLogin, specificErrors = false } = {},
) {
  const limit = await checkLoginRateLimit(ipAddress, username);
  if (!limit.allowed)
    throw new LoginError(
      "RATE_LIMITED",
      "Terlalu banyak percobaan login. Silakan coba kembali beberapa saat lagi.",
      429,
      { retryAfter: limit.retryAfter },
    );
  const user = await findUser(username);
  const matches = await bcrypt.compare(password, user?.password_hash || DUMMY_PASSWORD_HASH);
  if (!user || !matches) {
    await recordLoginFailure(ipAddress, username);
    if (specificErrors) {
      const code = user ? "PASSWORD_MISMATCH" : "USERNAME_NOT_FOUND";
      const message = user ? "Kata sandi tidak sesuai." : "Nama pengguna tidak ditemukan.";
      throw new LoginError(code, message, 401, {
        fieldErrors: { [user ? "password" : "username"]: message },
      });
    }
    throw new LoginError("INVALID_CREDENTIALS", "Username atau password tidak valid.", 401);
  }
  return user;
}
