import { handleMobileAuth } from "@/lib/auth/mobile/http";
export const runtime = "nodejs";
/** Login native tidak menerbitkan cookie browser. */
export const POST = (request) => handleMobileAuth(request, "login");
