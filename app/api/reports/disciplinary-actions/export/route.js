import { handleDisciplinaryReportRequest } from "@/lib/reports/disciplinaryRoute";

export async function GET(request) {
  return handleDisciplinaryReportRequest(request, true);
}
