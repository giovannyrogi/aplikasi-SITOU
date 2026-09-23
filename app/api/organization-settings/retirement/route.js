import { requirePermission } from "@/lib/auth/permissions";
import {
  getRequestId,
  handleRouteError,
  readJson,
  validateMutationRequest,
} from "@/lib/api/routeHelpers";
import { retirementPolicySchema } from "@/lib/retirement-policy/schema.mjs";
import { getRetirementPolicy, saveRetirementPolicy } from "@/lib/retirement-policy/service";

/** Kedua operasi memakai organisasi efektif dan permission server, serta tidak dicache publik. */
async function handle(request, write = false) {
  const requestId = getRequestId(request);
  try {
    const { user, response } = await requirePermission(
      write ? "retirement_policy.manage" : "retirement_policy.read",
    );
    if (response) return response;
    const organizationId = new URL(request.url).searchParams.get("organizationId");
    let data;
    if (write) {
      const denied = await validateMutationRequest(request, user.id, requestId);
      if (denied) return denied;
      const parsed = await readJson(request, retirementPolicySchema, requestId);
      if (parsed.response) return parsed.response;
      data = await saveRetirementPolicy(user, organizationId, parsed.data, requestId);
    } else data = await getRetirementPolicy(user, organizationId);
    return Response.json(
      { success: true, data },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return handleRouteError("retirement-policy", error, requestId);
  }
}

/** Membaca kebijakan untuk satu organisasi. */
export async function GET(request) {
  return handle(request);
}
/** Memperbarui kebijakan setelah konfirmasi pengguna. */
export async function PUT(request) {
  return handle(request, true);
}
