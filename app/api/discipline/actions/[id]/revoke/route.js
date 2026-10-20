import { requirePermission, resolvePermissionOrganization } from "@/lib/auth/permissions";
import {
  getRequestId,
  handleRouteError,
  readJson,
  successResponse,
  validateMutationRequest,
} from "@/lib/api/routeHelpers";
import { disciplinaryActionRevokeSchema } from "@/lib/discipline/schemas";
import {
  revokeDisciplinaryAction,
  getDisciplinaryRevocationContext,
} from "@/lib/discipline/service";

/** Preview pemulihan tidak menerima pilihan pegawai dari klien. */
export async function GET(request, { params }) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("discipline.manage");
  if (response) return response;
  try {
    const { id } = await params;
    const organizationId = resolvePermissionOrganization(
      user,
      new URL(request.url).searchParams.get("organizationId"),
    );
    return successResponse(await getDisciplinaryRevocationContext(id, organizationId, user));
  } catch (error) {
    return handleRouteError("discipline.actions.revoke-preview", error, requestId);
  }
}

/** Mencabut tindakan aktif tanpa menghapus keputusan, surat, atau histori kasus. */
export async function POST(request, { params }) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("discipline.manage");
  if (response) return response;
  const rejected = await validateMutationRequest(request, user.id, requestId);
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
      message: data.restoredActions?.length
        ? "Sanksi berhasil dicabut. Sanksi sebelumnya yang masih berlaku telah dipulihkan."
        : "Tindakan disiplin berhasil dicabut dan tetap tersimpan dalam histori.",
    });
  } catch (error) {
    return handleRouteError("discipline.actions.revoke", error, requestId);
  }
}
