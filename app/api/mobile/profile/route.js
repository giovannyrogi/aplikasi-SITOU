import { handleMobileProfile } from "@/lib/auth/mobile/profile";
export const runtime = "nodejs";
export const GET = (request) => handleMobileProfile(request);
