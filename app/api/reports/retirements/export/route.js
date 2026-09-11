import { handleReportRequest } from "@/lib/reports/route";
/** Mengunduh seluruh hasil filter pensiun yang diizinkan. */
export async function GET(request) {
  return handleReportRequest(request, "retirements", true);
}
