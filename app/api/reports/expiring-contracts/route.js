import { handleReportRequest } from "@/lib/reports/route";
/** Membaca kontrak mendekati akhir beserta lanjutannya. */
export async function GET(request) {
  return handleReportRequest(request, "expiring-contracts");
}
