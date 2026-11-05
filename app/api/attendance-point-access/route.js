import { z } from "zod";
import { requireRole, resolveOrganizationAccess } from "@/app/utils/auth";
import {
  getRequestId,
  handleRouteError,
  errorResponse,
  parseListQuery,
  readJson,
  successResponse,
  validateMutationRequest,
} from "@/lib/api/routeHelpers";
import {
  accessOptions,
  changePointAccess,
  listPointAccess,
  readPointConfiguration,
} from "@/lib/attendance-points/service";
import { dateValid } from "@/lib/work-schedules/rules.mjs";

const id = z.string().regex(/^[1-9]\d{0,17}$/, "Pilihan tidak valid.");
const date = z.string().refine(dateValid, "Tanggal tidak valid.");
const inputSchema = z.union([
  z.object({ organizationId: id, revokeId: id }).strict(),
  z
    .object({
      organizationId: id,
      employeeId: id,
      pointIds: z
        .array(id)
        .min(1)
        .max(25)
        .refine((ids) => new Set(ids).size === ids.length, "Titik tidak boleh berulang."),
      from: date,
      until: date.nullable(),
    })
    .strict()
    .refine((input) => !input.until || input.until >= input.from, {
      path: ["until"],
      message: "Tanggal akhir tidak boleh sebelum tanggal mulai.",
    }),
]);

export async function GET(request) {
  const requestId = getRequestId(request);
  const { user, response } = await requireRole(["superadmin", "hrd"]);
  if (response) return response;
  const params = new URL(request.url).searchParams;
  const org = id.safeParse(params.get("organizationId"));
  const location = id.optional().safeParse(params.get("locationId") ?? undefined);
  const kind = params.get("options");
  const query = parseListQuery(params);
  if (
    !org.success ||
    !location.success ||
    (kind && !["points", "employees"].includes(kind)) ||
    (query.search?.length ?? 0) > 100
  )
    return errorResponse(
      "VALIDATION_ERROR",
      "Periksa pilihan organisasi atau filter.",
      400,
      requestId,
    );
  const scope = resolveOrganizationAccess(user, org.data);
  if (scope.response) return scope.response;
  try {
    const organizationId = scope.organizationId;
    if (params.get("configuration") === "1")
      return successResponse(await readPointConfiguration(user, organizationId, location.data));
    if (kind)
      return successResponse(await accessOptions(user, organizationId, kind, query.search ?? ""));
    const result = await listPointAccess(user, organizationId, {
      ...query,
      search: query.search ?? "",
      status: query.status ?? "all",
    });
    return successResponse(result.data, {
      pagination: { page: query.page, pageSize: query.pageSize, total: result.total },
    });
  } catch (error) {
    return handleRouteError("attendancePointAccess.read", error, requestId);
  }
}

export async function POST(request) {
  const requestId = getRequestId(request);
  const { user, response } = await requireRole(["superadmin", "hrd"]);
  if (response) return response;
  const rejected = await validateMutationRequest(request, user.id, requestId);
  if (rejected) return rejected;
  const { data, response: invalid } = await readJson(request, inputSchema, requestId);
  if (invalid) return invalid;
  const scope = resolveOrganizationAccess(user, data.organizationId);
  if (scope.response) return scope.response;
  try {
    await changePointAccess(user, scope.organizationId, data, requestId);
    return successResponse(null, {
      message: data.revokeId ? "Akses titik dicabut." : "Akses titik disimpan.",
    });
  } catch (error) {
    return handleRouteError("attendancePointAccess.write", error, requestId);
  }
}
