import { handleSchedule } from "@/lib/work-schedules/http";
export const runtime = "nodejs";
export const GET = (request) => handleSchedule(request, "patterns");
export const POST = (request) => handleSchedule(request, "patterns");
