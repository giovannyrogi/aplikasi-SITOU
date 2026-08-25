import {
  ensureActorEmployeeAccess,
  requirePermission,
  resolvePermissionOrganization,
} from "@/lib/auth/permissions";
import {
  getRequestId,
  errorResponse,
  handleRouteError,
  readJson,
  successResponse,
  validateMutationRequest,
} from "@/lib/api/routeHelpers";
import {
  employeeProfileMultipartSchema,
  employeeProfileUpdateSchema,
} from "@/lib/employees/profileSchemas";
import {
  getEmployeeProfileSections,
  updateEmployeeProfileSections,
} from "@/lib/employees/profileService";

/** Mengambil section profil sensitif setelah permission dan scope pegawai diperiksa. */
export async function GET(request, { params }) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("employees.read_sensitive");
  if (response) return response;
  try {
    const { id } = await params;
    const organizationId = resolvePermissionOrganization(
      user,
      new URL(request.url).searchParams.get("organizationId"),
    );
    await ensureActorEmployeeAccess(user, id, organizationId);
    return successResponse(
      await getEmployeeProfileSections(id, organizationId, undefined, {
        includeBankAccounts: user.role_code !== "leader",
      }),
    );
  } catch (error) {
    return handleRouteError("employees.profile.get", error, requestId);
  }
}

/** Mengganti data administratif nonhistoris tanpa menyentuh kontrak dan penempatan. */
export async function PATCH(request, { params }) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("employees.update");
  if (response) return response;
  const isMultipart = request.headers.get("content-type")?.includes("multipart/form-data");
  const rejected = validateMutationRequest(request, user.id, requestId, {
    maxBytes: isMultipart ? 110 * 1024 * 1024 : undefined,
  });
  if (rejected) return rejected;
  let parsed;
  let pendingUploads = [];
  if (isMultipart) {
    try {
      const formData = await request.formData();
      const payload = JSON.parse(String(formData.get("payload") || ""));
      const result = employeeProfileMultipartSchema.safeParse(payload);
      if (!result.success) {
        const fieldErrors = Object.fromEntries(
          result.error.issues.map((issue) => [issue.path.join(".") || "form", issue.message]),
        );
        return errorResponse(
          "VALIDATION_ERROR",
          "Periksa kembali data yang diisi.",
          400,
          requestId,
          fieldErrors,
        );
      }
      pendingUploads = result.data.uploads.map((upload) => {
        const file = formData.get(`upload:${upload.token}`);
        if (!file || typeof file.arrayBuffer !== "function")
          throw new Error("File profil tidak lengkap.");
        return { ...upload, file };
      });
      parsed = { data: result.data, response: null };
    } catch {
      return errorResponse(
        "INVALID_MULTIPART",
        "Data profil atau file yang dikirim tidak valid.",
        400,
        requestId,
      );
    }
  } else {
    parsed = await readJson(request, employeeProfileUpdateSchema, requestId);
  }
  if (parsed.response) return parsed.response;
  try {
    const { id } = await params;
    const organizationId = resolvePermissionOrganization(user, parsed.data.organizationId);
    const data = await updateEmployeeProfileSections(
      id,
      organizationId,
      parsed.data.profile,
      parsed.data.removedFileIds,
      user,
      requestId,
      pendingUploads,
    );
    return successResponse(data, {
      code: "EMPLOYEE_PROFILE_UPDATED",
      message: "Data administratif pegawai berhasil diperbarui.",
    });
  } catch (error) {
    return handleRouteError("employees.profile.update", error, requestId);
  }
}
