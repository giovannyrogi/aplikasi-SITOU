import { handleCatalog } from "@/lib/holiday-catalogs/http";
export const runtime = "nodejs";
export const POST = (request) => handleCatalog(request, true, true);
