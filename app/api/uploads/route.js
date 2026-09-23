import {
  requirePermission,
  resolvePermissionOrganization,
  ensureActorEmployeeAccess,
} from "@/lib/auth/permissions";
import {
  errorResponse,
  getRequestId,
  handleRouteError,
  ServiceError,
  successResponse,
  validateMutationRequest,
} from "@/lib/api/routeHelpers";
import { listEmployeeFiles } from "@/lib/files/storage";

const MAX_REQUEST_BYTES = 11 * 1024 * 1024;
const COMPOSITE_FILE_KINDS = new Set([
  "pas_foto",
  "ktp",
  "kk",
  "npwp",
  "bpjs_kesehatan",
  "bpjs_ketenagakerjaan",
  "identitas_lain",
  "pendidikan",
  "sertifikasi",
  "kontrak",
  "sk_penempatan",
  "lampiran_cuti",
  "sanksi_sp1",
  "sanksi_sp2",
  "sanksi_sp3",
  "sanksi_lainnya",
  "employee_import",
]);

/** Mengembalikan metadata file pegawai; isi file tetap diakses melalui route file ID. */
export async function GET(request) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("private_files.read_sensitive");
  if (response) return response;
  try {
    const searchParams = new URL(request.url).searchParams;
    const organizationId = resolvePermissionOrganization(user, searchParams.get("organizationId"));
    const employeeId = searchParams.get("employeeId");
    if (!/^\d+$/.test(employeeId || ""))
      return errorResponse("EMPLOYEE_REQUIRED", "Pegawai wajib dipilih.", 400, requestId);
    await ensureActorEmployeeAccess(user, employeeId, organizationId);
    return successResponse(await listEmployeeFiles(employeeId, organizationId));
  } catch (error) {
    return handleRouteError("uploads.list", error, requestId);
  }
}

/** Menyimpan file pegawai privat dan hanya mengembalikan ID metadata. */
export async function POST(request) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("private_files.manage");
  if (response) return response;
  const rejected = await validateMutationRequest(request, user.id, requestId, {
    maxBytes: MAX_REQUEST_BYTES,
  });
  if (rejected) return rejected;
  return errorResponse(
    "UPLOAD_ENDPOINT_DISABLED",
    "Upload file wajib dilakukan bersama formulir pemiliknya.",
    410,
    requestId,
  );
}
