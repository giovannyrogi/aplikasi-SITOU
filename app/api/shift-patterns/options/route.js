import { handleSchedule } from "@/lib/work-schedules/http";
export const GET = (request) => handleSchedule(request, "masterOptions");
