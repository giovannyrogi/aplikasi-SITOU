import { ROLES } from "@/app/constants/roles";
import { requireRole } from "@/app/utils/auth";
import { parsePositiveInteger } from "@/app/utils/apiValidation";
import { errorResponse, getRequestId, successResponse } from "@/lib/api/routeHelpers";
import { getLocationOptions } from "@/lib/master-data/service";

export async function GET(request) {
  const requestId = getRequestId(request);
  const { response } = await requireRole([ROLES.SUPERADMIN]);
  if (response) return response;
  const parsed = parsePositiveInteger(
    new URL(request.url).searchParams.get("organizationId"),
    "ID organisasi",
  );
  if (parsed.error) return errorResponse("INVALID_ID", parsed.error, 400, requestId);
  return successResponse(await getLocationOptions(parsed.value));
}
