import { handleCatalog } from "@/lib/holiday-catalogs/http";
export const runtime = "nodejs";
export const GET = (request) => handleCatalog(request);
