import { requirePermission, resolvePermissionOrganization } from "@/lib/auth/permissions";
import { getRequestId, handleRouteError } from "@/lib/api/routeHelpers";
import { leaveFile } from "@/lib/leave/http";
export async function GET(request, { params }) {
  const requestId = getRequestId(request);
  const auth = await requirePermission("leave_types.read");
  if (auth.response) return auth.response;
  try {
    const org = resolvePermissionOrganization(
      auth.user,
      new URL(request.url).searchParams.get("organizationId"),
    );
    return await leaveFile({ ...auth.user, organization_id: org }, (await params).fileId, {
      staff: true,
    });
  } catch (error) {
    return handleRouteError("leave.template", error, requestId);
  }
}
