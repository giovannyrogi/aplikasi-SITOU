import { handleMobileHistory } from "@/lib/attendance-points/mobile-history";

export const runtime = "nodejs";
export const GET = (request) => handleMobileHistory(request, "history");
