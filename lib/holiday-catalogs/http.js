import { requireRole, resolveOrganizationAccess } from "@/app/utils/auth";
import {
  getRequestId,
  errorResponse,
  readJson,
  validateMutationRequest,
} from "@/lib/api/routeHelpers";
import { catalogMutation, catalogYear, catalogSourceRequest } from "./schemas.mjs";
import { fetchCatalogSource } from "./sourceService";
import { scheduleValidationMessage } from "@/lib/work-schedules/schemas.mjs";
import { listCatalogs, readCatalog, mutateCatalog } from "./service";
export async function handleCatalog(request, platform = false, sourcePreview = false) {
  const requestId = getRequestId(request);
  const auth = await requireRole(platform ? ["superadmin"] : ["superadmin", "hrd"]);
  if (auth.response)
    return Response.json(
      { ...(await auth.response.json()), requestId },
      {
        status: auth.response.status,
        headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
      },
    );
  try {
    let result;
    if (request.method !== "GET") {
      if (!platform)
        return errorResponse("FORBIDDEN", "Anda tidak memiliki akses.", 403, requestId);
      const rejected = await validateMutationRequest(request, auth.user.id, requestId, {
        maxBytes: sourcePreview ? 1024 : 256 * 1024,
        ...(sourcePreview ? { maxRequests: 5, windowMs: 60000 } : {}),
      });
      if (rejected) return rejected;
      const parsed = await readJson(
        request,
        {
          safeParse: (value) =>
            (sourcePreview ? catalogSourceRequest : catalogMutation).safeParse(value, {
              error: scheduleValidationMessage,
            }),
        },
        requestId,
      );
      if (parsed.response) return parsed.response;
      result = {
        data: sourcePreview
          ? await fetchCatalogSource(auth.user, parsed.data.year, requestId)
          : await mutateCatalog(auth.user, parsed.data, requestId),
      };
    } else {
      const q = new URL(request.url).searchParams;
      const allowed = platform
        ? ["year", "page", "pageSize", "search", "status"]
        : ["year", "organizationId"];
      if (platform && ((q.get("search") || "") !== "" || ![null, "all"].includes(q.get("status"))))
        return errorResponse("VALIDATION_ERROR", "Gunakan filter tahun.", 400, requestId);
      if ([...q.keys()].some((k) => !allowed.includes(k)))
        return errorResponse("VALIDATION_ERROR", "Filter tidak sesuai.", 400, requestId);
      const year = q.has("year") ? catalogYear.safeParse(q.get("year")) : null;
      if (year && !year.success)
        return errorResponse("VALIDATION_ERROR", "Tahun tidak valid.", 400, requestId);
      if (platform) {
        const page = Number(q.get("page") || 1),
          pageSize = Number(q.get("pageSize") || 20);
        if (
          !Number.isInteger(page) ||
          page < 1 ||
          !Number.isInteger(pageSize) ||
          pageSize < 1 ||
          pageSize > 100
        )
          return errorResponse("VALIDATION_ERROR", "Halaman tidak valid.", 400, requestId);
        result = await listCatalogs(auth.user, { year: year?.data, page, pageSize });
      } else {
        const requested = q.get("organizationId") || undefined;
        if (requested && !/^[1-9]\d{0,17}$/.test(requested))
          return errorResponse("VALIDATION_ERROR", "Organisasi tidak valid.", 400, requestId);
        const scope = resolveOrganizationAccess(auth.user, requested);
        if (scope.response) return scope.response;
        result = { data: await readCatalog(auth.user, String(scope.organizationId), year?.data) };
      }
    }
    return Response.json(
      { success: true, code: "SUCCESS", message: "Berhasil.", requestId, ...result },
      { headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } },
    );
  } catch (e) {
    if (e.status && e.code)
      return errorResponse(e.code, e.message, e.status, requestId, e.fieldErrors);
    if (e.code === "23505")
      return errorResponse(
        "CATALOG_CONFLICT",
        "Katalog berubah atau tanggal berulang. Muat ulang.",
        409,
        requestId,
      );
    console.error("[holiday-catalog]", { requestId, code: e.code || "INTERNAL_ERROR" });
    return errorResponse("INTERNAL_ERROR", "Terjadi gangguan. Coba lagi.", 500, requestId);
  }
}
