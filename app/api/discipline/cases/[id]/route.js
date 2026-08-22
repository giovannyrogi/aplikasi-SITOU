import { requirePermission, resolvePermissionOrganization } from "@/lib/auth/permissions";
import {
  getRequestId,
  handleRouteError,
  readJson,
  successResponse,
  validateMutationRequest,
} from "@/lib/api/routeHelpers";
import { disciplineCaseUpdateSchema } from "@/lib/discipline/schemas";
import { getDisciplineCase, updateDisciplineCase } from "@/lib/discipline/service";

/** Mengambil detail kasus beserta histori tindakan. */
export async function GET(request, { params }) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("discipline.read");
  if (response) return response;
  try {
    const { id } = await params;
    const organizationId = resolvePermissionOrganization(
      user,
      new URL(request.url).searchParams.get("organizationId"),
    );
    return successResponse(await getDisciplineCase(id, organizationId));
  } catch (error) {
    return handleRouteError("discipline.cases.detail", error, requestId);
  }
}

/** Memperbarui hasil pemeriksaan atau menutup kasus tanpa tindakan. */
export async function PATCH(request, { params }) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("discipline.manage");
  if (response) return response;
  const rejected = validateMutationRequest(request, user.id, requestId);
  if (rejected) return rejected;
  const parsed = await readJson(request, disciplineCaseUpdateSchema, requestId);
  if (parsed.response) return parsed.response;
  try {
    const { id } = await params;
    const organizationId = resolvePermissionOrganization(user, parsed.data.organizationId);
    const data = await updateDisciplineCase(
      id,
      { ...parsed.data, organizationId },
      user,
      requestId,
    );
    return successResponse(data, {
      code: "DISCIPLINE_CASE_UPDATED",
      message: "Kasus disiplin berhasil diperbarui.",
    });
  } catch (error) {
    return handleRouteError("discipline.cases.update", error, requestId);
  }
}
