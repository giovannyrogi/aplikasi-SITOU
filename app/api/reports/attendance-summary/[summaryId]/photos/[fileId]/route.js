import { handleAttendanceReport } from "@/lib/reports/attendanceRoute";

export function GET(request, { params }) {
  return handleAttendanceReport(request, "photo", params);
}
