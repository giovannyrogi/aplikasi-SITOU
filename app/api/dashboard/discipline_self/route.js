import { requireAuthenticatedUser } from "@/app/utils/auth";
import { readOwnDisciplineHistory } from "@/lib/discipline/selfHistory";
import {
  getRequestId,
  handleRouteError,
  successResponse,
  ServiceError,
} from "@/lib/api/routeHelpers";

export async function GET(request) {
  const requestId = getRequestId(request);
  const { user, response } = await requireAuthenticatedUser();
  if (response) return response;
  try {
    const query = new URL(request.url).searchParams;
    if ([...query.keys()].some((key) => key !== "cursor") || query.getAll("cursor").length > 1)
      throw new ServiceError("VALIDATION_ERROR", "Filter riwayat tidak valid.", 400);
    return successResponse(await readOwnDisciplineHistory(user, query.get("cursor")));
  } catch (error) {
    return handleRouteError("dashboard.discipline_self.history", error, requestId);
  }
}
