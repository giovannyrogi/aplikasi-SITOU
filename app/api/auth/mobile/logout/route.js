import { handleMobileAuth } from "@/lib/auth/mobile/http";
export const runtime = "nodejs";
/** Pencabutan sesi native bersifat idempotent. */
export const POST = (request) => handleMobileAuth(request, "logout");
