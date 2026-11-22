import { handleMobileProfile } from "@/lib/auth/mobile/profile";
export const runtime = "nodejs";
export const PATCH = (request) => handleMobileProfile(request, { password: true });
