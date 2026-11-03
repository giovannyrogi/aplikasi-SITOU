import { handleHolidayDeletion } from "@/lib/holiday-catalogs/deletion-http";
export const GET = (request, context) => handleHolidayDeletion(request, context, "catalog");
export const POST = GET;
