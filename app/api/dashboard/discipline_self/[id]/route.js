import { requireAuthenticatedUser } from "@/app/utils/auth";
import { getOwnDisciplineCase } from "@/lib/discipline/service";
import {
  getRequestId,
  handleRouteError,
  successResponse,
  ServiceError,
} from "@/lib/api/routeHelpers";

export async function GET(request, { params }) {
  const requestId = getRequestId(request);
  const { user, response } = await requireAuthenticatedUser();
  if (response) return response;
  try {
    const { id } = await params;
    if (!/^[1-9]\d*$/.test(id) || new URL(request.url).search)
      throw new ServiceError("VALIDATION_ERROR", "Pilihan rincian tidak valid.", 400);
    return successResponse(await getOwnDisciplineCase(id, user, requestId));
  } catch (error) {
    return handleRouteError("dashboard.discipline_self", error, requestId);
  }
}
