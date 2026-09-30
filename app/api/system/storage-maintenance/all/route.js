import { requirePermission } from "@/lib/auth/permissions";
import {
  getRequestId,
  handleRouteError,
  successResponse,
  ServiceError,
} from "@/lib/api/routeHelpers";
import { getAllStorageMaintenance } from "@/lib/storage-maintenance/service";

/** Aggregated read view is explicit and restricted to platform Superadmin. */
export async function GET(request) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("storage_maintenance.manage");
  if (response) return response;
  try {
    if (user.role_code !== "superadmin")
      throw new ServiceError(
        "ORGANIZATION_FORBIDDEN",
        "Akses seluruh organisasi hanya untuk Superadmin.",
        403,
      );
    const params = new URL(request.url).searchParams;
    const page = Math.max(1, Number.parseInt(params.get("page") || "1", 10) || 1);
    const pageSize = 20;
    const itemKind = ["candidate", "quarantine", "recovery", "security", "history"].includes(
      params.get("itemKind"),
    )
      ? params.get("itemKind")
      : "candidate";
    return successResponse(await getAllStorageMaintenance({ page, pageSize, itemKind }));
  } catch (error) {
    return handleRouteError("storage-maintenance.all", error, requestId);
  }
}
