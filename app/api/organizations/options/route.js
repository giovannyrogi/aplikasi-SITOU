import { ROLES } from "@/app/constants/roles";
import { requireRole } from "@/app/utils/auth";
import { successResponse } from "@/lib/api/routeHelpers";
import { getOrganizationOptions } from "@/lib/master-data/service";

export async function GET() {
  const { response } = await requireRole([ROLES.SUPERADMIN]);
  if (response) return response;
  return successResponse(await getOrganizationOptions());
}
