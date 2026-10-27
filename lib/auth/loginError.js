/** Error autentikasi bersama; details tidak pernah berisi password/token. */
export class LoginError extends Error {
  constructor(code, message, status, details = {}) {
    super(message);
    this.name = "LoginError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}
