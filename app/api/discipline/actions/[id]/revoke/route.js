import { requirePermission, resolvePermissionOrganization } from "@/lib/auth/permissions";
import {
  getRequestId,
  handleRouteError,
  readJson,
  successResponse,
  validateMutationRequest,
} from "@/lib/api/routeHelpers";
import { disciplinaryActionRevokeSchema } from "@/lib/discipline/schemas";
import { revokeDisciplinaryAction } from "@/lib/discipline/service";

/** Mencabut tindakan aktif tanpa menghapus keputusan, surat, atau histori kasus. */
export async function POST(request, { params }) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("discipline.manage");
  if (response) return response;
  const rejected = validateMutationRequest(request, user.id, requestId);
  if (rejected) return rejected;
  const parsed = await readJson(request, disciplinaryActionRevokeSchema, requestId);
  if (parsed.response) return parsed.response;
  try {
    const { id } = await params;
    const organizationId = resolvePermissionOrganization(user, parsed.data.organizationId);
    const data = await revokeDisciplinaryAction(
      id,
      { ...parsed.data, organizationId },
      user,
      requestId,
    );
    return successResponse(data, {
      code: "DISCIPLINARY_ACTION_REVOKED",
      message: "Tindakan disiplin berhasil dicabut dan tetap tersimpan dalam histori.",
    });
  } catch (error) {
    return handleRouteError("discipline.actions.revoke", error, requestId);
  }
}
