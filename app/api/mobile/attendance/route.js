import { handleAttendance } from "@/lib/attendance-points/mobile";
export const runtime = "nodejs";
export const GET = (request) => handleAttendance(request, "read");
