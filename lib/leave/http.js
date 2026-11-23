import pool from "@/lib/dbConfig";
import { requireMobileUser } from "@/lib/auth/mobile/service";
import { LoginError } from "@/lib/auth/loginError";
import {
  actorHasPermission,
  requirePermission,
  resolvePermissionOrganization,
} from "@/lib/auth/permissions";
import {
  getRequestId,
  successResponse,
  errorResponse,
  handleRouteError,
  readJson,
  readMultipartJson,
  validateMutationRequest,
  validateRequestOrigin,
  ServiceError,
} from "@/lib/api/routeHelpers";
import {
  getStoredFile,
  createStoredFileStream,
  assertStoredFileAvailable,
  sanitizeDownloadName,
} from "@/lib/files/storage";
import {
  leaveInput,
  leaveAction,
  leaveOptions,
  previewLeave,
  leaveList,
  leaveDetail,
  mutateLeave,
} from "./workflow";

async function ownActor(request, write) {
  const { user } = await requireMobileUser(request, { write });
  const actor = {
    id: user.id,
    organization_id: user.organizationId,
    employee_id: user.employeeId,
    role_code: user.role,
  };
  for (const code of ["leave_requests.read_self", ...(write ? ["leave_requests.submit_self"] : [])])
    if (!(await actorHasPermission(actor, code)))
      throw new ServiceError("FORBIDDEN", "Anda belum memiliki akses cuti dan izin.", 403);
  return actor;
}
function failure(context, error, id) {
  if (error instanceof LoginError)
    return errorResponse(error.code, error.message, error.status, id);
  if (["55P03", "57014"].includes(error.code))
    return errorResponse(
      "LEAVE_BUSY",
      "Pengajuan sedang diproses. Tunggu sebentar, lalu coba lagi.",
      503,
      id,
    );
  return handleRouteError(context, error, id);
}
async function readPayload(request, schema, id) {
  const parsed = await (request.headers.get("content-type")?.startsWith("multipart/form-data")
    ? readMultipartJson(request, schema, id)
    : readJson(request, schema, id));
  if (parsed.form && parsed.form.getAll("file").length > 1) {
    await parsed.cleanup?.();
    throw new ServiceError("LEAVE_ATTACHMENT_LIMIT", "Maksimal satu dokumen pendukung.", 422);
  }
  return parsed;
}
export async function leaveFile(actor, fileId, { staff = false } = {}) {
  if (!staff && !(await actorHasPermission(actor, "private_files.read_self")))
    throw new ServiceError("FILE_FORBIDDEN", "Anda belum memiliki akses dokumen pribadi.", 403);
  if (!/^[1-9]\d*$/.test(fileId))
    throw new ServiceError("INVALID_ID", "Dokumen tidak tersedia.", 404);
  const f = await getStoredFile(fileId, actor.organization_id);
  const allowed = await pool.query(
    `SELECT 1 FROM leave_types t WHERE t.organization_id=$1 AND t.template_file_id=$2
      AND ($3::bigint IS NULL OR EXISTS(SELECT 1 FROM employees e WHERE e.organization_id=$1 AND e.id=$3
        AND t.is_active AND (t.eligible_gender='all' OR t.eligible_gender=e.gender)))
    UNION ALL SELECT 1 FROM leave_requests r WHERE r.organization_id=$1
      AND ($3::bigint IS NULL OR r.employee_id=$3) AND (r.policy_snapshot->>'templateFileId'=$2::text
        OR EXISTS(SELECT 1 FROM leave_request_attachments a WHERE a.organization_id=$1 AND a.leave_request_id=r.id AND a.file_id=$2)) LIMIT 1`,
    [actor.organization_id, fileId, staff ? null : actor.employee_id],
  );
  if (!allowed.rowCount)
    throw new ServiceError("FILE_FORBIDDEN", "Dokumen tidak dapat diakses.", 403);
  if (staff && f.employee_id) {
    const { ensureActorEmployeeAccess } = await import("@/lib/auth/permissions");
    await ensureActorEmployeeAccess(actor, f.employee_id, actor.organization_id);
  }
  await assertStoredFileAvailable(f);
  return new Response(createStoredFileStream(f), {
    headers: {
      "Content-Type": f.mime_type,
      "Content-Disposition": `attachment; filename="${sanitizeDownloadName(f.original_name)}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
export async function mobileLeaveHttp(request, { params }) {
  const requestId = getRequestId(request);
  let parsed;
  try {
    const originError = validateRequestOrigin(request, requestId);
    if (originError) return originError;
    const parts = (await params).path || [];
    const key = parts.join("/");
    const write = request.method !== "GET";
    const actor = await ownActor(request, write);
    const authorize = async (db) => {
      await requireMobileUser(request, { write: true, database: db });
      if (!(await actorHasPermission(actor, "leave_requests.submit_self", db)))
        throw new ServiceError("FORBIDDEN", "Akses pengajuan sudah berubah.", 403);
    };
    if (!write) {
      if (parts[0] === "files" && parts.length === 2) return leaveFile(actor, parts[1]);
      if (key === "options")
        return successResponse(
          await leaveOptions(actor, new URL(request.url).searchParams.get("workDate")),
        );
      if (key === "requests") {
        const cursor = new URL(request.url).searchParams.get("cursor");
        if (cursor && !/^[1-9]\d*$/.test(cursor))
          throw new ServiceError("INVALID_CURSOR", "Muat ulang daftar pengajuan.", 400);
        return successResponse(await leaveList(actor, { before: cursor }));
      }
      if (parts[0] === "requests" && /^\d+$/.test(parts[1]) && parts.length === 2)
        return successResponse(await leaveDetail(pool, actor, parts[1]));
    } else {
      const reject = await validateMutationRequest(request, actor.id, requestId, {
        maxBytes: 11 * 1024 * 1024,
      });
      if (reject) return reject;
      if (key === "preview" || key === "requests") {
        parsed = await readPayload(request, leaveInput, requestId);
        if (parsed.response) return parsed.response;
        if (key === "preview") {
          const existing = parsed.data.existingRequestId
            ? await leaveDetail(pool, actor, parsed.data.existingRequestId)
            : null;
          if (existing && existing.rawStatus !== "needs_revision")
            throw new ServiceError("LEAVE_NOT_EDITABLE", "Pengajuan belum dapat diperbaiki.", 409);
          if (existing && String(parsed.data.leaveTypeId) !== existing.leave_type_id)
            throw new ServiceError("LEAVE_TYPE_FIXED", "Jenis cuti tidak dapat diganti.", 422);
          return successResponse(await previewLeave(pool, actor, parsed.data, existing));
        }
        return successResponse(
          await mutateLeave(actor, parsed.data, null, "create", parsed.file, requestId, {
            authorize,
          }),
          { status: 201, message: "Pengajuan berhasil dikirim." },
        );
      }
      if (
        parts[0] === "requests" &&
        /^\d+$/.test(parts[1]) &&
        parts[2] === "actions" &&
        parts.length === 3
      ) {
        parsed = await readPayload(request, leaveAction, requestId);
        if (parsed.response) return parsed.response;
        if (!["documents", "resubmit", "cancel"].includes(parsed.data.action))
          throw new ServiceError("FORBIDDEN", "Tindakan tidak diizinkan.", 403);
        return successResponse(
          await mutateLeave(
            actor,
            parsed.data,
            parts[1],
            parsed.data.action,
            parsed.file,
            requestId,
            { authorize },
          ),
          { message: "Pengajuan berhasil diperbarui." },
        );
      }
    }
    return errorResponse("NOT_FOUND", "Layanan tidak tersedia.", 404, requestId);
  } catch (error) {
    return failure("mobile.leave", error, requestId);
  } finally {
    await parsed?.cleanup?.();
  }
}
export async function staffLeaveAction(request, { params }) {
  const requestId = getRequestId(request);
  let parsed;
  try {
    const auth = await requirePermission("leave_requests.manage");
    if (auth.response) return auth.response;
    if (!["hrd", "superadmin"].includes(auth.user.role_code))
      throw new ServiceError("FORBIDDEN", "Tindakan hanya tersedia untuk HRD.", 403);
    const org = resolvePermissionOrganization(
      auth.user,
      new URL(request.url).searchParams.get("organizationId"),
    );
    const { id } = await params;
    if (!/^[1-9]\d*$/.test(id))
      throw new ServiceError("INVALID_ID", "Pengajuan tidak ditemukan.", 404);
    const reject = await validateMutationRequest(request, auth.user.id, requestId, {
      maxBytes: 11 * 1024 * 1024,
    });
    if (reject) return reject;
    parsed = await readPayload(request, leaveAction, requestId);
    if (parsed.response) return parsed.response;
    if (!["approve", "reject", "revise", "documents"].includes(parsed.data.action))
      throw new ServiceError("INVALID_ACTION", "Tindakan tidak tersedia.", 422);
    return successResponse(
      await mutateLeave(
        { ...auth.user, organization_id: org },
        parsed.data,
        id,
        parsed.data.action,
        parsed.file,
        requestId,
        { staff: true },
      ),
      { message: "Pengajuan berhasil diperbarui." },
    );
  } catch (error) {
    return failure("leave.decision", error, requestId);
  } finally {
    await parsed?.cleanup?.();
  }
}
