import pool from "@/lib/dbConfig";
import { actorHasPermission } from "@/lib/auth/permissions";
import { ServiceError } from "@/lib/api/routeHelpers";

export async function requireSelfDisciplineAccess(actor, organizationId, database = pool) {
  if (
    actor.role_code !== "employee" ||
    String(actor.organization_id) !== String(organizationId) ||
    !(await actorHasPermission(actor, "disciplinary_actions.read_self", database))
  )
    throw new ServiceError("FORBIDDEN", "Anda tidak memiliki akses ke rincian sanksi ini.", 403);
}

export async function requireOwnOfficialCase(actor, caseId, database = pool) {
  await requireSelfDisciplineAccess(actor, actor.organization_id, database);
  const result = await database.query(
    `SELECT c.employee_id::text FROM discipline_cases c
    JOIN employees e ON e.organization_id=c.organization_id AND e.id=c.employee_id
    WHERE c.organization_id=$1 AND c.id=$2 AND e.user_id=$3 AND e.deleted_at IS NULL
      AND EXISTS (SELECT 1 FROM disciplinary_actions a WHERE a.organization_id=c.organization_id
        AND a.discipline_case_id=c.id AND a.employee_id=e.id AND a.status<>'draft')`,
    [actor.organization_id, caseId, actor.id],
  );
  if (!result.rowCount) throw new ServiceError("NOT_FOUND", "Kasus disiplin tidak ditemukan.", 404);
  return result.rows[0].employee_id;
}

export async function authorizeSelfDisciplineLetter(actor, file, database = pool) {
  await requireSelfDisciplineAccess(actor, file.organization_id, database);
  if (
    file.category !== "discipline_letter" ||
    !(await actorHasPermission(actor, "private_files.read_self", database))
  )
    throw new ServiceError("FILE_FORBIDDEN", "Surat tidak dapat diakses.", 403);
  const result = await database.query(
    `SELECT 1 FROM disciplinary_actions a
    JOIN employees e ON e.organization_id=a.organization_id AND e.id=a.employee_id
    WHERE a.organization_id=$1 AND a.document_file_id=$2 AND e.user_id=$3
      AND e.id=$4 AND e.deleted_at IS NULL AND a.status<>'draft' LIMIT 1`,
    [file.organization_id, file.id, actor.id, file.employee_id],
  );
  if (!result.rowCount) throw new ServiceError("FILE_FORBIDDEN", "Surat tidak dapat diakses.", 403);
}
