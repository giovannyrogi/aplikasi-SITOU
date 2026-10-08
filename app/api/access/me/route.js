import { requireAuthenticatedUser } from "@/app/utils/auth";
import { getAccessSnapshot } from "@/lib/access/packages";
import { successResponse, getRequestId, handleRouteError } from "@/lib/api/routeHelpers";
export async function GET(request) {
  const { user, response } = await requireAuthenticatedUser();
  if (response) return response;
  try {
    return successResponse(await getAccessSnapshot(user));
  } catch (error) {
    return handleRouteError("access.me", error, getRequestId(request));
  }
}
