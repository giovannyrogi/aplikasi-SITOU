import { ROLES } from "@/app/constants/roles";
import { requireRole } from "@/app/utils/auth";
import { parsePositiveInteger } from "@/app/utils/apiValidation";
import { subscriptionPeriodSchema } from "@/lib/master-data/schemas";
import {
  createOrganizationSubscription,
  listOrganizationSubscriptions,
} from "@/lib/subscriptions/service";
import {
  errorResponse,
  getRequestId,
  handleRouteError,
  readJson,
  successResponse,
  validateMutationRequest,
} from "@/lib/api/routeHelpers";

const getId = async (params, requestId) => {
  const parsed = parsePositiveInteger((await params).id, "ID organisasi");
  return parsed.error
    ? { response: errorResponse("INVALID_ID", parsed.error, 400, requestId) }
    : { id: parsed.value };
};
export async function GET(request, { params }) {
  const requestId = getRequestId(request);
  const { response } = await requireRole([ROLES.SUPERADMIN]);
  if (response) return response;
  const target = await getId(params, requestId);
  if (target.response) return target.response;
  try {
    return successResponse(await listOrganizationSubscriptions(target.id));
  } catch (error) {
    return handleRouteError("subscriptions.list", error, requestId);
  }
}
export async function POST(request, { params }) {
  const requestId = getRequestId(request);
  const { user, response } = await requireRole([ROLES.SUPERADMIN]);
  if (response) return response;
  const target = await getId(params, requestId);
  if (target.response) return target.response;
  const rejected = validateMutationRequest(request, user.id, requestId);
  if (rejected) return rejected;
  const parsed = await readJson(request, subscriptionPeriodSchema, requestId);
  if (parsed.response) return parsed.response;
  try {
    return successResponse(
      await createOrganizationSubscription(target.id, parsed.data, user, requestId),
      {
        status: 201,
        code: "SUBSCRIPTION_CREATED",
        message: "Periode langganan berhasil ditambahkan.",
      },
    );
  } catch (error) {
    return handleRouteError("subscriptions.create", error, requestId);
  }
}
