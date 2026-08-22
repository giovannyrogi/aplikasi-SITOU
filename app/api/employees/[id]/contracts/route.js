import { parsePositiveInteger } from "@/app/utils/apiValidation";
import { requirePermission, resolvePermissionOrganization } from "@/lib/auth/permissions";
import {
  errorResponse,
  getRequestId,
  handleRouteError,
  readJson,
  successResponse,
  validateMutationRequest,
} from "@/lib/api/routeHelpers";
import { employeeContractCreateSchema } from "@/lib/employees/schemas";
import { createEmployeeContract, getEmployeeHistory } from "@/lib/employees/service";

/** Menampilkan histori kontrak pegawai. */
export async function GET(request, context) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("contracts.read");
  if (response) return response;
  const id = parsePositiveInteger((await context.params).id, "ID pegawai");
  if (id.error) return errorResponse("INVALID_ID", id.error, 400, requestId);
  try {
    const organizationId = resolvePermissionOrganization(
      user,
      new URL(request.url).searchParams.get("organizationId"),
    );
    const history = await getEmployeeHistory(id.value, organizationId);
    return successResponse(history.contracts);
  } catch (error) {
    return handleRouteError("employee-contracts.list", error, requestId);
  }
}

/** Membuat kontrak/perpanjangan tanpa menimpa record lama. */
export async function POST(request, context) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("contracts.manage");
  if (response) return response;
  const rejected = validateMutationRequest(request, user.id, requestId);
  if (rejected) return rejected;
  const id = parsePositiveInteger((await context.params).id, "ID pegawai");
  if (id.error) return errorResponse("INVALID_ID", id.error, 400, requestId);
  const parsed = await readJson(request, employeeContractCreateSchema, requestId);
  if (parsed.response) return parsed.response;
  try {
    const organizationId = resolvePermissionOrganization(user, parsed.data.organizationId);
    const data = await createEmployeeContract(
      id.value,
      organizationId,
      parsed.data,
      user,
      requestId,
    );
    return successResponse(data.contracts, {
      status: 201,
      code: "CONTRACT_CREATED",
      message: "Kontrak kerja berhasil dicatat.",
    });
  } catch (error) {
    return handleRouteError("employee-contracts.create", error, requestId);
  }
}
