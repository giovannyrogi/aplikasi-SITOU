import { handleSchedule } from "@/lib/work-schedules/http";
export const runtime = "nodejs";
export const GET = (request) => handleSchedule(request, "shifts");
export const POST = (request) => handleSchedule(request, "shifts");
