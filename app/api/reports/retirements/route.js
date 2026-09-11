import { handleReportRequest } from "@/lib/reports/route";
/** Membaca proyeksi pensiun sesuai cakupan akun. */
export async function GET(request) {
  return handleReportRequest(request, "retirements");
}
