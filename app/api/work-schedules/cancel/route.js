import { handleSchedule } from "@/lib/work-schedules/http";
export const runtime = "nodejs";
export const POST = (request) => handleSchedule(request, "cancel");
