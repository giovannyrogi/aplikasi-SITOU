import { ROLES } from "@/app/constants/roles";
import { requireRole } from "@/app/utils/auth";
import { parsePositiveInteger } from "@/app/utils/apiValidation";
import {
  errorResponse,
  getRequestId,
  handleRouteError,
  readJson,
  successResponse,
  validateMutationRequest,
} from "@/lib/api/routeHelpers";
import { passwordResetSchema } from "@/lib/master-data/schemas";
import { resetAdminPassword } from "@/lib/master-data/service";

export async function PATCH(request, { params }) {
  const requestId = getRequestId(request);
  const { user, response } = await requireRole([ROLES.SUPERADMIN]);
  if (response) return response;
  const id = parsePositiveInteger((await params).id, "ID admin");
  if (id.error) return errorResponse("INVALID_ID", id.error, 400, requestId);
  const rejected = validateMutationRequest(request, user.id, requestId);
  if (rejected) return rejected;
  const parsed = await readJson(request, passwordResetSchema, requestId);
  if (parsed.response) return parsed.response;
  try {
    return successResponse(
      await resetAdminPassword(id.value, parsed.data.password, user, requestId),
      { code: "PASSWORD_RESET", message: "Password Admin/HRD berhasil diperbarui." },
    );
  } catch (error) {
    return handleRouteError("admin-users.password", error, requestId);
  }
}
