import { requirePermission, resolvePermissionOrganization } from "@/lib/auth/permissions";
import {
  getRequestId,
  handleRouteError,
  parseListQuery,
  readJson,
  successResponse,
  validateMutationRequest,
  errorResponse,
} from "@/lib/api/routeHelpers";
import { accountCreateSchema, accountListFilterSchema } from "@/lib/access/schemas";
import { createOrganizationAccount, listOrganizationAccounts } from "@/lib/access/service";

/** Menampilkan akun HRD, Pimpinan, dan Karyawan pada organisasi efektif. */
export async function GET(request) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("accounts.read");
  if (response) return response;
  try {
    const url = new URL(request.url);
    const query = parseListQuery(url.searchParams);
    const filters = accountListFilterSchema.safeParse({
      organizationId: url.searchParams.get("organizationId") || null,
      roleCode: url.searchParams.get("roleCode") || "all",
    });
    if (!filters.success)
      return errorResponse("VALIDATION_ERROR", "Filter akun tidak valid.", 400, requestId);
    const organizationId = resolvePermissionOrganization(user, filters.data.organizationId);
    const result = await listOrganizationAccounts({ ...query, ...filters.data, organizationId });
    return successResponse(result.data, {
      pagination: { page: query.page, pageSize: query.pageSize, total: result.total },
    });
  } catch (error) {
    return handleRouteError("access.accounts.list", error, requestId);
  }
}

/** Membuat akun organisasi; profil hanya wajib untuk role Karyawan. */
export async function POST(request) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("accounts.manage");
  if (response) return response;
  const rejected = validateMutationRequest(request, user.id, requestId);
  if (rejected) return rejected;
  const parsed = await readJson(request, accountCreateSchema, requestId);
  if (parsed.response) return parsed.response;
  try {
    const organizationId = resolvePermissionOrganization(user, parsed.data.organizationId);
    const data = await createOrganizationAccount(
      { ...parsed.data, organizationId },
      user,
      requestId,
    );
    return successResponse(data, {
      status: 201,
      code: "ACCOUNT_CREATED",
      message: "Akun organisasi berhasil dibuat.",
    });
  } catch (error) {
    return handleRouteError("access.accounts.create", error, requestId);
  }
}
