import pool from "@/lib/dbConfig";
import { actorHasPermission } from "@/lib/auth/permissions";
import { readEmployeeDashboard } from "@/lib/dashboard/workspaceRepository";
import { getSelfProfilePhoto } from "@/lib/files/selfProfilePhoto";
import {
  assertStoredFileAvailable,
  createStoredFileStream,
  sanitizeDownloadName,
} from "@/lib/files/storage";
import { writeAudit } from "@/lib/audit";
import {
  errorResponse,
  getRequestId,
  ServiceError,
  validateRequestOrigin,
} from "@/lib/api/routeHelpers";
import { LoginError } from "../loginError";
import { requireMobileUser } from "./service";

/** Minimal adapter: neither the caller nor a role's admin rights select another profile. */
function selfActor(user) {
  return {
    id: user.id,
    employee_id: user.employeeId,
    organization_id: user.organizationId,
    role_code: user.role,
  };
}

export async function readMobileHome(actor) {
  if (!(await actorHasPermission(actor, "employees.read_self")))
    throw new ServiceError("SELF_FORBIDDEN", "Anda tidak memiliki akses profil sendiri.", 403);
  const [assignmentAllowed, photoAllowed] = await Promise.all([
    actorHasPermission(actor, "assignments.read_self"),
    actorHasPermission(actor, "profile_self.read"),
  ]);
  const organization = (
    await pool.query("SELECT name,timezone FROM organizations WHERE id=$1", [actor.organization_id])
  ).rows[0];
  if (!organization)
    throw new ServiceError("ORGANIZATION_UNAVAILABLE", "Organisasi tidak tersedia.", 404);
  // Invalid organization configuration fails closed; never substitute the device zone.
  try {
    new Intl.DateTimeFormat("id-ID", { timeZone: organization.timezone }).format();
  } catch {
    throw new ServiceError(
      "TIMEZONE_UNAVAILABLE",
      "Pengaturan waktu organisasi tidak tersedia.",
      503,
    );
  }
  if (!organization.timezone)
    throw new ServiceError(
      "TIMEZONE_UNAVAILABLE",
      "Pengaturan waktu organisasi tidak tersedia.",
      503,
    );
  const row = await readEmployeeDashboard(actor, [true, assignmentAllowed, false]);
  if (!row || String(row.id) !== actor.employee_id)
    throw new ServiceError("PROFILE_NOT_LINKED", "Profil Pegawai tidak tersedia.", 404);
  return {
    profile: { name: row.full_name, hasPhoto: Boolean(photoAllowed && row.profile_photo_file_id) },
    organization: { name: organization.name, timezone: organization.timezone },
    placement: assignmentAllowed ? row.location_name || null : null,
    serverTime: new Date().toISOString(),
  };
}

export async function readMobilePhoto(actor, requestId) {
  if (
    !(await actorHasPermission(actor, "profile_self.read")) ||
    !(await actorHasPermission(actor, "employees.read_self"))
  )
    throw new ServiceError("SELF_FORBIDDEN", "Anda tidak memiliki akses profil sendiri.", 403);
  const file = await getSelfProfilePhoto(actor);
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.mime_type) ||
    Number(file.size_bytes) > 5 * 1024 * 1024
  )
    throw new ServiceError("PHOTO_UNAVAILABLE", "Pas foto profil belum tersedia.", 404);
  await assertStoredFileAvailable(file);
  await writeAudit(pool, {
    organizationId: actor.organization_id,
    actorUserId: actor.id,
    action: "private_file.preview",
    entityType: "stored_file",
    entityId: file.id,
    afterData: { employeeId: file.employee_id, category: file.category },
    requestId,
  });
  return new Response(createStoredFileStream(file), {
    headers: {
      "Content-Type": file.mime_type,
      "Content-Length": String(file.size_bytes),
      "Content-Disposition": `inline; filename="${sanitizeDownloadName(file.original_name)}"`,
      "Cache-Control": "private, no-store",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/** Both endpoints reject selectors; session identity is the only source of ownership. */
export async function handleMobileHome(request, { photo = false } = {}) {
  const requestId = getRequestId(request);
  const invalidOrigin = validateRequestOrigin(request, requestId);
  if (invalidOrigin) return invalidOrigin;
  try {
    const session = await requireMobileUser(request);
    if ([...new URL(request.url).searchParams].length)
      return errorResponse("VALIDATION_ERROR", "Profil tidak dapat dipilih.", 400, requestId, {
        profile: "Gunakan profil akun yang masuk.",
      });
    const actor = selfActor(session.user);
    if (photo) return await readMobilePhoto(actor, requestId);
    return Response.json(
      {
        success: true,
        code: "SUCCESS",
        message: "Berhasil.",
        requestId,
        data: await readMobileHome(actor),
      },
      { headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } },
    );
  } catch (error) {
    if (error instanceof LoginError || error instanceof ServiceError)
      return errorResponse(error.code, error.message, error.status, requestId);
    console.error("[mobile.home]", { requestId, code: "INTERNAL_ERROR" });
    return errorResponse("INTERNAL_ERROR", "Terjadi gangguan. Coba lagi.", 500, requestId);
  }
}
