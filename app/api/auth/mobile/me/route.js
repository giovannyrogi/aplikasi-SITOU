import { handleMobileAuth } from "@/lib/auth/mobile/http";
export const runtime = "nodejs";
/** Validasi ulang kelayakan sesi native. */
export const GET = (request) => handleMobileAuth(request, "me");
