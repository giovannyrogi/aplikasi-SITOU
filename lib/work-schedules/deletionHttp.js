import { z } from "zod";
import { requireRole, resolveOrganizationAccess } from "@/app/utils/auth";
import {
  errorResponse,
  getRequestId,
  readBoundedRequestText,
  ServiceError,
  validateMutationRequest,
} from "@/lib/api/routeHelpers";
import { deleteSchedule, readScheduleDeletion } from "./deletionService";

const idSchema = z.string().regex(/^[1-9]\d{0,17}$/);
const requestKeySchema = z.uuid();
const confirmationSchema = z
  .object({
    organizationId: idSchema,
    version: z.number().int().positive(),
    requestKey: requestKeySchema,
  })
  .strict();

export async function handleScheduleDeletion(request, context, kind) {
  const requestId = getRequestId(request);
  const auth = await requireRole(["superadmin"]);
  if (auth.response) {
    const status = auth.response.status;
    return errorResponse(
      status === 401 ? "SESSION_EXPIRED" : "FORBIDDEN",
      status === 401
        ? "Sesi Anda telah berakhir. Silakan masuk kembali."
        : "Hanya Admin SITOU yang dapat menghapus jadwal kerja.",
      status,
      requestId,
    );
  }
  try {
    const { id } = await context.params;
    const query = new URL(request.url).searchParams;
    const writing = request.method === "POST";
    const requestKey = query.get("requestKey");
    if (
      !idSchema.safeParse(id).success ||
      [...query.keys()].some((key) => writing || !["organizationId", "requestKey"].includes(key)) ||
      (requestKey !== null && !requestKeySchema.safeParse(requestKey).success)
    )
      return errorResponse(
        "VALIDATION_ERROR",
        "Permintaan penghapusan tidak sesuai. Muat ulang daftar.",
        400,
        requestId,
      );

    let input;
    if (writing) {
      const origin = request.headers.get("origin");
      if (!URL.canParse(origin ?? "") || !["http:", "https:"].includes(new URL(origin).protocol))
        return errorResponse(
          "INVALID_ORIGIN",
          "Asal permintaan tidak dapat diverifikasi. Muat ulang halaman.",
          403,
          requestId,
        );
      const rejected = await validateMutationRequest(request, auth.user.id, requestId, {
        maxBytes: 2048,
        maxRequests: 10,
        windowMs: 60000,
        rateLimitAction: "work-schedule.delete",
        rateLimitMessage: "Terlalu banyak percobaan. Tunggu sebentar, lalu coba lagi.",
      });
      if (rejected) return rejected;
      const raw = await readBoundedRequestText(request, 2048);
      const parsed = confirmationSchema.safeParse(JSON.parse(raw));
      if (!parsed.success)
        return errorResponse(
          "VALIDATION_ERROR",
          "Periksa kembali data penghapusan.",
          400,
          requestId,
        );
      input = parsed.data;
    }
    const requestedOrg = input?.organizationId ?? query.get("organizationId");
    if (!idSchema.safeParse(requestedOrg).success)
      return errorResponse("ORGANIZATION_REQUIRED", "Pilih organisasi yang sah.", 400, requestId);
    const scope = resolveOrganizationAccess(auth.user, requestedOrg);
    if (scope.response) return scope.response;
    const org = String(scope.organizationId);
    const data = writing
      ? await deleteSchedule(auth.user, kind, { ...input, organizationId: org, id }, requestId)
      : await readScheduleDeletion(auth.user, org, kind, id, requestKey);
    return Response.json(
      { success: true, data, requestId },
      { headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } },
    );
  } catch (error) {
    if (error instanceof SyntaxError)
      return errorResponse("INVALID_JSON", "Data penghapusan tidak dapat dibaca.", 400, requestId);
    if (error instanceof ServiceError)
      return errorResponse(error.code, error.message, error.status, requestId, error.fieldErrors);
    if (error.code === "23503")
      return errorResponse(
        "SCHEDULE_USED",
        "Jadwal ini masih dirujuk oleh data lain. Nonaktifkan jadwal jika sudah tidak diperlukan.",
        409,
        requestId,
      );
    console.error("[work-schedule.delete]", { requestId, code: error.code || "INTERNAL_ERROR" });
    const unknown =
      /^(08|57P0|ECONN|ETIMEDOUT|EPIPE)/.test(error.code || "") ||
      /connection.*(terminated|closed|timeout)/i.test(error.message || "");
    return unknown
      ? errorResponse(
          "DELETE_STATUS_UNKNOWN",
          "Status penghapusan belum dapat dipastikan. Periksa status sebelum mencoba kembali.",
          503,
          requestId,
        )
      : errorResponse(
          "DELETE_FAILED",
          "Jadwal belum dihapus karena terjadi kendala sistem. Silakan coba lagi.",
          500,
          requestId,
        );
  }
}
