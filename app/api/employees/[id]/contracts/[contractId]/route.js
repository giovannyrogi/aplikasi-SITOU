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
import {
  employeeContractCancellationSchema,
  employeeContractCorrectionSchema,
} from "@/lib/employees/schemas";
import { cancelEmployeeContract, correctEmployeeContract } from "@/lib/employees/service";

/** Memvalidasi kedua ID route agar query tidak pernah menerima identifier mentah. */
async function resolveRouteIds(context, requestId) {
  const params = await context.params;
  const employeeId = parsePositiveInteger(params.id, "ID pegawai");
  const contractId = parsePositiveInteger(params.contractId, "ID kontrak");
  if (employeeId.error || contractId.error)
    return {
      response: errorResponse("INVALID_ID", employeeId.error || contractId.error, 400, requestId),
    };
  return { employeeId: employeeId.value, contractId: contractId.value };
}

/** Koreksi kontrak memperbarui record yang sama dengan audit dan optimistic concurrency. */
export async function PATCH(request, context) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("contracts.manage");
  if (response) return response;
  const rejected = validateMutationRequest(request, user.id, requestId);
  if (rejected) return rejected;
  const ids = await resolveRouteIds(context, requestId);
  if (ids.response) return ids.response;
  const parsed = await readJson(request, employeeContractCorrectionSchema, requestId);
  if (parsed.response) return parsed.response;
  try {
    const organizationId = resolvePermissionOrganization(user, parsed.data.organizationId);
    const data = await correctEmployeeContract(
      ids.employeeId,
      ids.contractId,
      organizationId,
      parsed.data,
      user,
      requestId,
    );
    return successResponse(data.contracts, {
      code: "CONTRACT_CORRECTED",
      message: "Koreksi kontrak berhasil disimpan.",
    });
  } catch (error) {
    return handleRouteError("employee-contracts.correct", error, requestId);
  }
}

/** DELETE bermakna pembatalan logis; record kontrak dan dokumennya tidak dihapus. */
export async function DELETE(request, context) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("contracts.manage");
  if (response) return response;
  const rejected = validateMutationRequest(request, user.id, requestId);
  if (rejected) return rejected;
  const ids = await resolveRouteIds(context, requestId);
  if (ids.response) return ids.response;
  const parsed = await readJson(request, employeeContractCancellationSchema, requestId);
  if (parsed.response) return parsed.response;
  try {
    const organizationId = resolvePermissionOrganization(user, parsed.data.organizationId);
    const data = await cancelEmployeeContract(
      ids.employeeId,
      ids.contractId,
      organizationId,
      parsed.data,
      user,
      requestId,
    );
    return successResponse(data.contracts, {
      code: "CONTRACT_CANCELLED",
      message: "Kontrak dibatalkan dan tetap disimpan dalam histori.",
    });
  } catch (error) {
    return handleRouteError("employee-contracts.cancel", error, requestId);
  }
}
