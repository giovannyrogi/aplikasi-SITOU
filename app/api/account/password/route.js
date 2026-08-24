import { requirePermission } from "@/lib/auth/permissions";
import { getRequestId, handleRouteError, readJson, successResponse, validateMutationRequest } from "@/lib/api/routeHelpers";
import { selfPasswordSchema } from "@/lib/account/schemas";
import { changeSelfPassword } from "@/lib/account/service";

export async function PATCH(request) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("profile_self.update");
  if (response) return response;
  const rejected = validateMutationRequest(request, user.id, requestId);
  if (rejected) return rejected;
  const parsed = await readJson(request, selfPasswordSchema, requestId);
  if (parsed.response) return parsed.response;
  try {
    return successResponse(await changeSelfPassword(parsed.data, user, requestId), {
      code: "PASSWORD_CHANGED", message: "Password berhasil diubah. Silakan login kembali.",
    });
  } catch (error) { return handleRouteError("account.password.update", error, requestId); }
}
