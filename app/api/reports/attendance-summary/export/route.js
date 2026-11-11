import { handleAttendanceReport } from "@/lib/reports/attendanceRoute";

export function GET(request) {
  return handleAttendanceReport(request, "export");
}
