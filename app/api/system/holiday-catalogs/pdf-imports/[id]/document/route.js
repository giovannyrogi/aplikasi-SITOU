import { holidayPdfDocument } from "@/lib/holiday-catalogs/pdf-document";
export const runtime = "nodejs";
export async function GET(request, { params }) {
  return holidayPdfDocument(request, (await params).id, true);
}
