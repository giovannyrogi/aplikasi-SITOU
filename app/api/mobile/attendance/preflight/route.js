import { handleAttendance } from "@/lib/attendance-points/mobile";
export const runtime = "nodejs";
export const POST = (request) => handleAttendance(request, "preflight");
