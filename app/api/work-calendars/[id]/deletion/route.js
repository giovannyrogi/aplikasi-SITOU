import { handleHolidayDeletion } from "@/lib/holiday-catalogs/deletion-http";
export const GET = (request, context) => handleHolidayDeletion(request, context, "calendar");
export const POST = GET;
