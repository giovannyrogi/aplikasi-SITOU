import { requirePermission } from "@/lib/auth/permissions";
import { getRequestId, handleRouteError, readJson, successResponse, validateMutationRequest } from "@/lib/api/routeHelpers";
import { selfProfileUpdateSchema } from "@/lib/account/schemas";
import { getSelfProfile, updateSelfProfile } from "@/lib/account/service";

export async function GET(request) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("profile_self.read");
  if (response) return response;
  try { return successResponse(await getSelfProfile(user.id)); }
  catch (error) { return handleRouteError("account.profile.get", error, requestId); }
}

export async function PATCH(request) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("profile_self.update");
  if (response) return response;
  const rejected = validateMutationRequest(request, user.id, requestId);
  if (rejected) return rejected;
  const parsed = await readJson(request, selfProfileUpdateSchema, requestId);
  if (parsed.response) return parsed.response;
  try {
    return successResponse(await updateSelfProfile(parsed.data, user, requestId), {
      code: "PROFILE_UPDATED", message: "Profil berhasil diperbarui.",
    });
  } catch (error) { return handleRouteError("account.profile.update", error, requestId); }
}
