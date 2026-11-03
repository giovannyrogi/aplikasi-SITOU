import { requireRole } from "@/app/utils/auth";
import {
  getRequestId,
  errorResponse,
  successResponse,
  validateMutationRequest,
} from "@/lib/api/routeHelpers";
import { parseMultipartToPrivateTemp } from "@/lib/api/multipart";
import { catalogYear } from "@/lib/holiday-catalogs/schemas.mjs";
import { uploadHolidayPdf } from "@/lib/holiday-catalogs/pdf-service";
export const runtime = "nodejs";
export async function POST(request) {
  const requestId = getRequestId(request),
    auth = await requireRole(["superadmin"]);
  if (auth.response) return auth.response;
  let form;
  try {
    const denied = await validateMutationRequest(request, auth.user.id, requestId, {
      maxBytes: 11 * 1024 * 1024,
      maxRequests: 5,
      windowMs: 60000,
    });
    if (denied) return denied;
    form = await parseMultipartToPrivateTemp(request);
    const year = catalogYear.safeParse(form.get("year")),
      key = form.get("requestKey");
    if (
      !year.success ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(key)) ||
      [...form.keys()].some((k) => !["year", "requestKey", "file"].includes(k)) ||
      ["year", "requestKey", "file"].some((k) => form.getAll(k).length !== 1)
    )
      return errorResponse(
        "VALIDATION_ERROR",
        "Tahun atau formulir unggah tidak valid.",
        400,
        requestId,
      );
    return successResponse(
      await uploadHolidayPdf(auth.user, form.get("file"), year.data, key, requestId),
      { status: 202 },
    );
  } catch (e) {
    return errorResponse(
      e.status ? e.code : "PDF_UPLOAD_FAILED",
      e.status ? e.message : "PDF belum dapat diunggah. Coba lagi.",
      e.status || 500,
      requestId,
    );
  } finally {
    await form?.cleanup();
  }
}
