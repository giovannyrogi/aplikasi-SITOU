import { requirePermission } from "@/lib/auth/permissions";
import {
  getRequestId,
  handleRouteError,
  readJson,
  successResponse,
  validateMutationRequest,
} from "@/lib/api/routeHelpers";
import { selfProfileLinkSchema } from "@/lib/account/schemas";
import { getSelfProfileLinkOptions, linkSelfProfile } from "@/lib/account/service";

export async function GET(request) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("profile_self.update");
  if (response) return response;
  try {
    return successResponse(await getSelfProfileLinkOptions(user));
  } catch (error) {
    return handleRouteError("account.profile.link-options", error, requestId);
  }
}

export async function PATCH(request) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("profile_self.update");
  if (response) return response;
  const rejected = validateMutationRequest(request, user.id, requestId);
  if (rejected) return rejected;
  const parsed = await readJson(request, selfProfileLinkSchema, requestId);
  if (parsed.response) return parsed.response;
  try {
    return successResponse(await linkSelfProfile(parsed.data, user, requestId), {
      code: "PROFILE_LINKED",
      message: "Akun berhasil dikaitkan ke profil pegawai.",
    });
  } catch (error) {
    return handleRouteError("account.profile.link", error, requestId);
  }
}
