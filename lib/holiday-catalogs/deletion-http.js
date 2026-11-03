import { z } from "zod";
import { requireRole, resolveOrganizationAccess } from "@/app/utils/auth";
import {
  getRequestId,
  errorResponse,
  readJson,
  validateMutationRequest,
} from "@/lib/api/routeHelpers";
import { withTransaction } from "@/lib/dbTransaction";
import { writeAudit } from "@/lib/audit";
import { requireScheduleAccess, organization } from "@/lib/work-schedules/repository";
import { deleteHoliday, deletionPreview, deletionReceipt } from "./deletion-service.mjs";

const schema = z
  .object({
    version: z.number().int().positive(),
    requestKey: z.uuid(),
    organizationId: z
      .string()
      .regex(/^[1-9]\d{0,17}$/)
      .optional(),
  })
  .strict();
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
export async function handleHolidayDeletion(request, context, kind) {
  const requestId = getRequestId(request);
  const auth = await requireRole(["superadmin"]);
  if (auth.response)
    return errorResponse(
      auth.response.status === 401 ? "SESSION_EXPIRED" : "FORBIDDEN",
      auth.response.status === 401
        ? "Sesi Anda telah berakhir. Silakan masuk kembali."
        : "Anda tidak memiliki izin untuk menghapus data ini.",
      auth.response.status,
      requestId,
    );
  try {
    const { id } = await context.params;
    if (!/^[1-9]\d{0,17}$/.test(id))
      return errorResponse("VALIDATION_ERROR", "Identitas data tidak valid.", 400, requestId);
    const q = new URL(request.url).searchParams;
    if ([...q.keys()].some((k) => !["organizationId", "requestKey"].includes(k)))
      return errorResponse("VALIDATION_ERROR", "Parameter tidak sesuai.", 400, requestId);
    let input;
    if (request.method === "POST") {
      if (!request.headers.get("origin"))
        return errorResponse(
          "INVALID_ORIGIN",
          "Asal permintaan tidak dapat diverifikasi. Muat ulang halaman, lalu coba lagi.",
          403,
          requestId,
        );
      const rejection = await validateMutationRequest(request, auth.user.id, requestId, {
        maxBytes: 2048,
        maxRequests: 10,
        windowMs: 60000,
        rateLimitAction: "holiday.delete",
        rateLimitMessage: "Terlalu banyak percobaan. Tunggu sebentar, lalu coba lagi.",
      });
      if (rejection) return rejection;
      const parsed = await readJson(
        request,
        {
          safeParse: (value) =>
            schema.safeParse(value, {
              error: (issue) =>
                ({
                  version: "Versi data tidak valid. Muat ulang halaman.",
                  requestKey: "Kunci permintaan tidak valid. Muat ulang halaman.",
                  organizationId: "Pilih organisasi yang sah.",
                })[issue.path?.[0]] ||
                "Permintaan penghapusan tidak sesuai. Muat ulang halaman, lalu coba lagi.",
            }),
        },
        requestId,
      );
      if (parsed.response) return parsed.response;
      input = parsed.data;
    }
    let org = null;
    if (kind === "calendar") {
      const requested = input?.organizationId || q.get("organizationId");
      if (!requested || !/^[1-9]\d{0,17}$/.test(requested))
        return errorResponse("VALIDATION_ERROR", "Pilih organisasi yang sah.", 400, requestId);
      const scope = resolveOrganizationAccess(auth.user, requested);
      if (scope.response) return scope.response;
      org = String(scope.organizationId);
    } else if (input?.organizationId || q.has("organizationId"))
      return errorResponse(
        "VALIDATION_ERROR",
        "Katalog merupakan referensi platform.",
        400,
        requestId,
      );
    const key = q.get("requestKey");
    if (key && !z.uuid().safeParse(key).success)
      return errorResponse("VALIDATION_ERROR", "Kunci permintaan tidak valid.", 400, requestId);
    const data = await withTransaction(async (db) => {
      if (org) {
        await requireScheduleAccess(db, auth.user, org, "work-calendars", true);
        await organization(db, org, true);
      }
      if (input) return deleteHoliday(db, auth.user, kind, id, org, input, requestId);
      if (key) return deletionReceipt(db, auth.user, kind, id, org, key);
      const preview = (await deletionPreview(db, auth.user, kind, id, org)).data;
      await writeAudit(db, {
        organizationId: org,
        actorUserId: auth.user.id,
        action: `holiday_${kind}.delete_preview`,
        entityType: `holiday_${kind}`,
        entityId: id,
        afterData: {
          eligible: preview.eligible,
          code: preview.code,
          usageCount: preview.usageCount,
        },
        requestId,
      });
      return preview;
    });
    return Response.json({ success: true, data, requestId }, { headers });
  } catch (e) {
    if (e.status && e.code) return errorResponse(e.code, e.message, e.status, requestId);
    console.error("[holiday.delete]", { requestId, code: e.code || "INTERNAL_ERROR" });
    if (
      /^(08|57P0|ECONN|ETIMEDOUT)/.test(e.code || "") ||
      /connection.*(terminated|closed|timeout)/i.test(e.message || "")
    )
      return errorResponse(
        "DELETE_STATUS_UNKNOWN",
        "Status penghapusan belum dapat dipastikan. Periksa status sebelum mencoba kembali.",
        503,
        requestId,
      );
    return errorResponse(
      "DELETE_FAILED",
      "Data belum dihapus karena terjadi kendala sistem. Silakan coba lagi.",
      500,
      requestId,
    );
  }
}
