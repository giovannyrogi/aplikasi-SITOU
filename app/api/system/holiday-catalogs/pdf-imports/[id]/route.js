import { requireRole } from "@/app/utils/auth";
import { getRequestId, errorResponse, successResponse } from "@/lib/api/routeHelpers";
import { readHolidayPdfImport } from "@/lib/holiday-catalogs/pdf-service";
export const runtime = "nodejs";
export async function GET(request, { params }) {
  const auth = await requireRole(["superadmin"]);
  if (auth.response) return auth.response;
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
    return errorResponse("NOT_FOUND", "Pembacaan tidak ditemukan.", 404, getRequestId(request));
  try {
    return successResponse(await readHolidayPdfImport(auth.user, id));
  } catch (e) {
    return errorResponse(
      e.code || "INTERNAL_ERROR",
      e.status ? e.message : "Pembacaan belum dapat dimuat.",
      e.status || 500,
      getRequestId(request),
    );
  }
}
