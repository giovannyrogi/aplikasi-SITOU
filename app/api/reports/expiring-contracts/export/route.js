import { handleReportRequest } from "@/lib/reports/route";
/** Mengunduh seluruh hasil filter kontrak yang diizinkan. */
export async function GET(request) {
  return handleReportRequest(request, "expiring-contracts", true);
}
