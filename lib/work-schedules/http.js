import { requireRole, resolveOrganizationAccess } from "@/app/utils/auth";
import {
  getRequestId,
  errorResponse,
  readJson,
  validateMutationRequest,
} from "@/lib/api/routeHelpers";
import * as service from "./service";
import * as schema from "./schemas.mjs";
/** Route bersama mempertahankan origin, envelope dan pesan aman SITOU. */
export async function handleSchedule(request, operation) {
  const requestId = getRequestId(request);
  const auth = await requireRole(["superadmin", "hrd"]);
  if (auth.response)
    return Response.json(
      { ...(await auth.response.json()), requestId },
      {
        status: auth.response.status,
        headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
      },
    );
  try {
    const u = new URL(request.url);
    let input, org;
    const writing = request.method !== "GET";
    if (writing) {
      const rejected = await validateMutationRequest(request, auth.user.id, requestId, {
        maxBytes: 256 * 1024,
      });
      if (rejected) return rejected;
      const selected = {
        shifts: schema.shiftSchema,
        patterns: schema.patternSchema,
        calendars: schema.calendarSchema,
        assign: schema.assignmentSchema,
        exception: schema.exceptionSchema,
        cancel: schema.cancelSchema,
        preview: schema.rangeSchema,
        generate: schema.rangeSchema,
      }[operation];
      const parsed = await readJson(
        request,
        {
          safeParse: (value) =>
            selected.safeParse(value, { error: schema.scheduleValidationMessage }),
        },
        requestId,
      );
      if (parsed.response) return parsed.response;
      input = parsed.data;
    } else {
      const allowed = [
        "organizationId",
        "page",
        "pageSize",
        "q",
        "search",
        "status",
        "without",
        "employeeId",
      ];
      if ([...u.searchParams.keys()].some((k) => !allowed.includes(k)))
        return errorResponse("VALIDATION_ERROR", "Filter tidak sesuai.", 400, requestId, {
          filter: "Gunakan filter yang tersedia.",
        });
      input = { organizationId: u.searchParams.get("organizationId") || undefined };
    }
    if (input.organizationId && !/^[1-9]\d{0,17}$/.test(input.organizationId))
      return errorResponse("VALIDATION_ERROR", "Organisasi tidak valid.", 400, requestId, {
        organizationId: "Pilih organisasi.",
      });
    const scope = resolveOrganizationAccess(auth.user, input.organizationId);
    if (scope.response) return scope.response;
    org = String(scope.organizationId);
    input.organizationId = org;
    let data, pagination;
    if (!writing) {
      const page = Number(u.searchParams.get("page") || 1),
        pageSize = Number(u.searchParams.get("pageSize") || 20),
        q = u.searchParams.get("q") || u.searchParams.get("search") || "";
      if (
        !Number.isInteger(page) ||
        page < 1 ||
        !Number.isInteger(pageSize) ||
        pageSize < 1 ||
        pageSize > 100 ||
        q.length > 100
      )
        return errorResponse("VALIDATION_ERROR", "Filter tidak sesuai.", 400, requestId, {
          filter: "Periksa filter halaman.",
        });
      if (
        (u.searchParams.has("status") &&
          !["all", "active", "inactive"].includes(u.searchParams.get("status"))) ||
        (u.searchParams.has("without") &&
          !["true", "false"].includes(u.searchParams.get("without")))
      )
        return errorResponse("VALIDATION_ERROR", "Filter tidak sesuai.", 400, requestId);
      if (operation === "options") data = await service.options(auth.user, org, q);
      else if (operation === "masterOptions") data = await service.masterOptions(auth.user, org, q);
      else {
        const employeeId = u.searchParams.get("employeeId");
        if (employeeId && !/^[1-9]\d{0,17}$/.test(employeeId))
          return errorResponse("VALIDATION_ERROR", "Pegawai tidak valid.", 400, requestId, {
            employeeId: "Pilih Pegawai.",
          });
        const result =
          operation === "employees"
            ? await service.listEmployees(auth.user, org, {
                page,
                pageSize,
                q,
                without: u.searchParams.get("without") === "true",
                employeeId,
              })
            : await service.listMasters(auth.user, org, operation, {
                page,
                pageSize,
                q,
                status: u.searchParams.get("status") || "all",
              });
        data = result.data;
        pagination = { page, pageSize, total: result.total };
      }
    } else if (["shifts", "patterns", "calendars"].includes(operation))
      data = await service.saveMaster(auth.user, input, operation, requestId);
    else
      data = await {
        assign: service.assign,
        preview: service.preview,
        generate: service.generate,
        exception: service.saveException,
        cancel: service.cancelAssignment,
      }[operation](auth.user, input, requestId);
    return Response.json(
      {
        success: true,
        code: "SUCCESS",
        message: writing
          ? operation === "preview"
            ? "Pratinjau tersedia."
            : "Berhasil disimpan."
          : "Berhasil.",
        data,
        requestId,
        ...(pagination ? { pagination } : {}),
      },
      { headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } },
    );
  } catch (e) {
    if (e.code === "23505")
      return errorResponse("NAME_CONFLICT", "Nama sudah digunakan.", 409, requestId, {
        name: "Nama sudah digunakan.",
      });
    if (e.code === "23P01")
      return errorResponse("SCHEDULE_OVERLAP", "Jadwal bertabrakan.", 409, requestId, {
        sessions: "Periksa periode dan sesi kerja.",
      });
    if (e instanceof Error && e.status && e.code)
      return errorResponse(e.code, e.message, e.status, requestId, e.fieldErrors);
    console.error("[work-schedules]", { requestId, code: e.code || "INTERNAL_ERROR" });
    return errorResponse("INTERNAL_ERROR", "Terjadi gangguan. Coba lagi.", 500, requestId);
  }
}
