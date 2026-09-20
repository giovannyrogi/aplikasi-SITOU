import pool from "@/lib/dbConfig";
import { withTransaction } from "@/lib/dbTransaction";
import { writeAudit } from "@/lib/audit";
import { ServiceError } from "@/lib/api/routeHelpers";

const TYPE_SELECT = `SELECT type.id::text,type.organization_id::text,
  organization.name AS organization_name,type.name,type.duration_mode,type.duration_value,
  type.duration_unit,type.requires_document,type.is_active,type.created_at,type.updated_at,
  (SELECT count(*)::int FROM disciplinary_actions action
    WHERE action.organization_id=type.organization_id AND action.action_type_id=type.id) AS usage_count
  FROM disciplinary_action_types type
  JOIN organizations organization ON organization.id=type.organization_id`;

function normalizeDuration(input) {
  return input.durationMode === "fixed"
    ? { value: input.durationValue, unit: input.durationUnit }
    : { value: null, unit: null };
}

function mapDuplicate(error) {
  if (error?.code === "23505")
    throw new ServiceError(
      "DUPLICATE_DISCIPLINARY_ACTION_TYPE",
      "Nama sanksi tersebut sudah tersedia pada organisasi ini.",
      409,
      { name: "Gunakan nama sanksi yang berbeda." },
    );
  throw error;
}

export async function listDisciplinaryActionTypes({
  organizationId,
  search,
  status,
  page,
  pageSize,
}) {
  const offset = (page - 1) * pageSize;
  const params = [organizationId || null, `%${search}%`, status, pageSize, offset];
  const where = `WHERE ($1::bigint IS NULL OR type.organization_id=$1)
    AND ($2='' OR type.name ILIKE $2)
    AND ($3='all' OR type.is_active=($3='active'))`;
  const [rows, count] = await Promise.all([
    pool.query(
      `${TYPE_SELECT} ${where} ORDER BY organization.name,type.name,type.id LIMIT $4 OFFSET $5`,
      params,
    ),
    pool.query(
      `SELECT count(*)::int AS total FROM disciplinary_action_types type ${where}`,
      params.slice(0, 3),
    ),
  ]);
  return { data: rows.rows, total: count.rows[0].total };
}

export async function getDisciplinaryActionTypeOptions(organizationId, activeOnly = true) {
  const result = await pool.query(
    `SELECT id::text,name,duration_mode,duration_value,duration_unit,requires_document,is_active,
      (system_key IN ('sp2','sp3')) AS allows_direct_escalation,
      CASE WHEN system_key IN ('sp1','sp2','sp3') THEN 'sanksi_'||system_key
        ELSE 'sanksi_lainnya' END AS upload_file_kind
     FROM disciplinary_action_types
     WHERE organization_id=$1 AND ($2=false OR is_active=true)
     ORDER BY CASE system_key
       WHEN 'oral_warning' THEN 1 WHEN 'sp1' THEN 2 WHEN 'sp2' THEN 3
       WHEN 'sp3' THEN 4 WHEN 'suspension' THEN 5 WHEN 'demotion' THEN 6 ELSE 99 END,
       name,id`,
    [organizationId, activeOnly],
  );
  return result.rows;
}

export async function createDisciplinaryActionType(input, actor, requestId) {
  try {
    return await withTransaction(async (client) => {
      const duration = normalizeDuration(input);
      const inserted = await client.query(
        `INSERT INTO disciplinary_action_types
          (organization_id,name,duration_mode,duration_value,duration_unit,
           requires_document,is_active,created_by_user_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [
          input.organizationId,
          input.name,
          input.durationMode,
          duration.value,
          duration.unit,
          input.requiresDocument,
          input.isActive,
          actor.id,
        ],
      );
      await writeAudit(client, {
        organizationId: input.organizationId,
        actorUserId: actor.id,
        action: "disciplinary_action_type.create",
        entityType: "disciplinary_action_type",
        entityId: inserted.rows[0].id,
        afterData: { ...input, durationValue: duration.value, durationUnit: duration.unit },
        requestId,
      });
      const row = await client.query(
        `${TYPE_SELECT} WHERE type.id=$1 AND type.organization_id=$2`,
        [inserted.rows[0].id, input.organizationId],
      );
      return row.rows[0];
    });
  } catch (error) {
    mapDuplicate(error);
  }
}

export async function updateDisciplinaryActionType(id, input, actor, requestId) {
  try {
    return await withTransaction(async (client) => {
      const before = await client.query(
        "SELECT * FROM disciplinary_action_types WHERE id=$1 AND organization_id=$2 FOR UPDATE",
        [id, input.organizationId],
      );
      if (!before.rows[0])
        throw new ServiceError(
          "DISCIPLINARY_ACTION_TYPE_NOT_FOUND",
          "Pengaturan sanksi tidak ditemukan.",
          404,
        );
      const duration = normalizeDuration(input);
      const name = actor.role_code === "superadmin" ? input.name : before.rows[0].name;
      const updated = await client.query(
        `UPDATE disciplinary_action_types
         SET name=$3,duration_mode=$4,duration_value=$5,duration_unit=$6,
           requires_document=$7,is_active=$8
         WHERE id=$1 AND organization_id=$2
           AND date_trunc('milliseconds',updated_at)=date_trunc('milliseconds',$9::timestamptz)
         RETURNING id`,
        [
          id,
          input.organizationId,
          name,
          input.durationMode,
          duration.value,
          duration.unit,
          input.requiresDocument,
          input.isActive,
          input.version,
        ],
      );
      if (!updated.rowCount)
        throw new ServiceError(
          "VERSION_CONFLICT",
          "Pengaturan sanksi telah berubah. Muat ulang sebelum menyimpan.",
          409,
        );
      await writeAudit(client, {
        organizationId: input.organizationId,
        actorUserId: actor.id,
        action: "disciplinary_action_type.update",
        entityType: "disciplinary_action_type",
        entityId: id,
        beforeData: before.rows[0],
        afterData: {
          name,
          durationMode: input.durationMode,
          durationValue: duration.value,
          durationUnit: duration.unit,
          requiresDocument: input.requiresDocument,
          isActive: input.isActive,
        },
        requestId,
      });
      const row = await client.query(
        `${TYPE_SELECT} WHERE type.id=$1 AND type.organization_id=$2`,
        [id, input.organizationId],
      );
      return row.rows[0];
    });
  } catch (error) {
    mapDuplicate(error);
  }
}
