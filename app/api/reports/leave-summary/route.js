import { handleLeaveReportRequest } from "@/lib/reports/leaveRoute";
export async function GET(request) {
  return handleLeaveReportRequest(request);
}
