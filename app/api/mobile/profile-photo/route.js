import { handleMobileHome } from "@/lib/auth/mobile/home";
export const runtime = "nodejs";
export const GET = (request) => handleMobileHome(request, { photo: true });
