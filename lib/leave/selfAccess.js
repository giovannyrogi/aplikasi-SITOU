import pool from "@/lib/dbConfig";
import { actorHasPermission } from "@/lib/auth/permissions";
import { ServiceError } from "@/lib/api/routeHelpers";

export async function requireSelfLeaveAccess(actor, organizationId, database = pool) {
  if (
    !["employee", "hrd", "leader"].includes(actor.role_code) ||
    String(actor.organization_id) !== String(organizationId) ||
    !(await actorHasPermission(actor, "leave_requests.read_self", database))
  ) {
    throw new ServiceError("FORBIDDEN", "Anda tidak memiliki akses ke cuti dan izin ini.", 403);
  }
}

export async function authorizeSelfLeaveAttachment(actor, file, database = pool) {
  await requireSelfLeaveAccess(actor, file.organization_id, database);
  if (
    file.category !== "leave_attachment" ||
    !(await actorHasPermission(actor, "private_files.read_self", database))
  )
    throw new ServiceError("FILE_FORBIDDEN", "Lampiran tidak dapat diakses.", 403);
  const result = await database.query(
    `SELECT 1 FROM leave_request_attachments attachment
    JOIN leave_requests request ON request.organization_id=attachment.organization_id AND request.id=attachment.leave_request_id
    JOIN employees employee ON employee.organization_id=request.organization_id AND employee.id=request.employee_id
    WHERE attachment.organization_id=$1 AND attachment.file_id=$2 AND employee.user_id=$3
      AND employee.id=$4 AND employee.deleted_at IS NULL AND request.status<>'draft' LIMIT 1`,
    [file.organization_id, file.id, actor.id, file.employee_id],
  );
  if (!result.rowCount)
    throw new ServiceError("FILE_FORBIDDEN", "Lampiran tidak dapat diakses.", 403);
}
