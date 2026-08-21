import { ROLES } from "@/app/constants/roles";
import { requireRole } from "@/app/utils/auth";
import { parsePositiveInteger } from "@/app/utils/apiValidation";
import { subscriptionActionSchema } from "@/lib/master-data/schemas";
import { changeOrganizationSubscription } from "@/lib/subscriptions/service";
import {
  errorResponse,
  getRequestId,
  handleRouteError,
  readJson,
  successResponse,
  validateMutationRequest,
} from "@/lib/api/routeHelpers";

const getIds = async (params, requestId) => {
  const values = await params;
  const organization = parsePositiveInteger(values.id, "ID organisasi");
  const subscription = parsePositiveInteger(values.subscriptionId, "ID langganan");
  if (organization.error || subscription.error)
    return {
      response: errorResponse(
        "INVALID_ID",
        organization.error || subscription.error,
        400,
        requestId,
      ),
    };
  return { organizationId: organization.value, subscriptionId: subscription.value };
};
export async function PATCH(request, { params }) {
  const requestId = getRequestId(request);
  const { user, response } = await requireRole([ROLES.SUPERADMIN]);
  if (response) return response;
  const target = await getIds(params, requestId);
  if (target.response) return target.response;
  const rejected = validateMutationRequest(request, user.id, requestId);
  if (rejected) return rejected;
  const parsed = await readJson(request, subscriptionActionSchema, requestId);
  if (parsed.response) return parsed.response;
  try {
    return successResponse(
      await changeOrganizationSubscription(
        target.organizationId,
        target.subscriptionId,
        parsed.data,
        user,
        requestId,
      ),
      { code: "SUBSCRIPTION_UPDATED", message: "Status langganan berhasil diperbarui." },
    );
  } catch (error) {
    return handleRouteError("subscriptions.change", error, requestId);
  }
}
