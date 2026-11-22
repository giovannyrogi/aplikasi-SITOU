import pool from "@/lib/dbConfig";
import { withMobileAccountTransaction } from "./accountTransaction";
import { actorHasPermission } from "@/lib/auth/permissions";
import { getSelfProfile, changeSelfPassword } from "@/lib/account/service";
import { selfPasswordSchema } from "@/lib/account/schemas";
import {
  getRequestId,
  validateRequestOrigin,
  validateMutationRequest,
  readBoundedRequestText,
  errorResponse,
  ServiceError,
} from "@/lib/api/routeHelpers";
import { requireMobileUser } from "./service";
import { LoginError } from "../loginError";

const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
const actorOf = (user) => ({
  id: user.id,
  employee_id: user.employeeId,
  organization_id: user.organizationId,
  role_code: user.role,
});

async function requireProfileAccess(user, write = false, database = pool) {
  const actor = actorOf(user);
  const permissions = ["employees.read_self", write ? "profile_self.update" : "profile_self.read"];
  for (const permission of permissions) {
    if (!(await actorHasPermission(actor, permission, database)))
      throw new ServiceError("SELF_FORBIDDEN", "Anda tidak memiliki akses profil sendiri.", 403);
  }
  return actor;
}

export async function readMobileProfile(user) {
  const actor = await requireProfileAccess(user);
  const profile = await getSelfProfile(actor.id);
  if (
    profile.employee_id !== user.employeeId ||
    profile.employee_organization_id !== user.organizationId
  )
    throw new ServiceError("PROFILE_FORBIDDEN", "Profil Pegawai tidak tersedia.", 403);
  const assignments = await actorHasPermission(actor, "assignments.read_self");
  const canChangePassword =
    user.accessMode === "self_service" && (await actorHasPermission(actor, "profile_self.update"));
  return {
    name: profile.full_name,
    employeeNo: profile.employee_no,
    username: profile.username,
    organization: profile.employee_organization_name,
    location: assignments ? profile.location_name : null,
    unit: assignments ? profile.organization_unit_name : null,
    position: assignments ? profile.position_name : null,
    employmentStatus: profile.employment_status,
    employmentType: profile.employment_type_name,
    email: profile.personal_email || profile.work_email || null,
    whatsapp: profile.whatsapp,
    canChangePassword,
  };
}

export async function handleMobileProfile(request, { password = false } = {}) {
  const requestId = getRequestId(request);
  const originError = validateRequestOrigin(request, requestId);
  if (originError) return originError;
  try {
    const session = await requireMobileUser(request, { write: password });
    if ([...new URL(request.url).searchParams].length)
      return errorResponse("VALIDATION_ERROR", "Gunakan profil akun yang masuk.", 400, requestId);
    await requireProfileAccess(session.user, password);
    let data;
    if (password) {
      const rejected = await validateMutationRequest(request, session.user.id, requestId, {
        maxBytes: 4096,
        maxRequests: 5,
        windowMs: 15 * 60 * 1000,
        rateLimitAction: "mobile.profile.password",
        rateLimitMessage: "Terlalu banyak percobaan. Coba lagi nanti.",
      });
      if (rejected) return rejected;
      if (
        request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !==
        "application/json"
      )
        return errorResponse("UNSUPPORTED_MEDIA_TYPE", "Format data tidak sesuai.", 415, requestId);
      let body;
      try {
        body = JSON.parse(await readBoundedRequestText(request, 4096));
      } catch (error) {
        if (error.code === "PAYLOAD_TOO_LARGE") throw error;
        return errorResponse("INVALID_JSON", "Format data tidak sesuai.", 400, requestId);
      }
      const parsed = selfPasswordSchema.safeParse(body);
      if (!parsed.success) {
        const fields = {};
        for (const issue of parsed.error.issues) {
          const message =
            issue.code === "invalid_type"
              ? "Kata sandi harus berupa teks."
              : issue.code === "unrecognized_keys"
                ? "Data yang dikirim tidak sesuai."
                : issue.message
                    .replaceAll("Password", "Kata sandi")
                    .replaceAll("password", "kata sandi");
          fields[issue.path[0] || "form"] ||= message;
        }
        return errorResponse("VALIDATION_ERROR", Object.values(fields)[0], 400, requestId, fields);
      }
      if (Buffer.byteLength(parsed.data.currentPassword, "utf8") > 72)
        return errorResponse(
          "VALIDATION_ERROR",
          "Kata sandi saat ini maksimal 72 byte.",
          400,
          requestId,
          { currentPassword: "Kata sandi saat ini maksimal 72 byte." },
        );
      data = await withMobileAccountTransaction(async (client) => {
        // Serialisasi dengan login dan perubahan kredensial, lalu verifikasi ulang sesi.
        await client.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [session.user.id]);
        const fresh = await requireMobileUser(request, { write: true, database: client });
        const actor = await requireProfileAccess(fresh.user, true, client);
        return changeSelfPassword(parsed.data, actor, requestId, client);
      });
    } else data = await readMobileProfile(session.user);
    return Response.json(
      {
        success: true,
        code: password ? "PASSWORD_CHANGED" : "SUCCESS",
        message: password ? "Kata sandi berhasil diubah. Silakan masuk kembali." : "Berhasil.",
        requestId,
        data,
      },
      { headers },
    );
  } catch (error) {
    if (error instanceof LoginError || error instanceof ServiceError) {
      const fields =
        error.code === "CURRENT_PASSWORD_INVALID"
          ? { currentPassword: "Kata sandi saat ini tidak benar." }
          : undefined;
      return errorResponse(
        error.code,
        fields?.currentPassword || error.message,
        error.status,
        requestId,
        fields,
      );
    }
    console.error("[mobile.profile]", { requestId, code: "INTERNAL_ERROR" });
    return errorResponse("INTERNAL_ERROR", "Terjadi gangguan. Coba lagi.", 500, requestId);
  }
}
