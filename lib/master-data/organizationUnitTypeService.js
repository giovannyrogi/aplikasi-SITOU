import pool from "@/lib/dbConfig";
import { withTransaction } from "@/lib/dbTransaction";
import { writeAudit } from "@/lib/audit";
import { ServiceError } from "@/lib/api/routeHelpers";
import { ensureActiveOrganization } from "@/lib/master-data/guards";
import { isOrganizationUnitTypeCodeLocked } from "@/lib/master-data/organizationUnitTypeRules.mjs";

const typeSelect = `
  SELECT type.id::text,type.organization_id::text,organization.name AS organization_name,
    type.code,type.name,type.description,type.sort_order,type.is_active,type.updated_at,
    (SELECT count(*)::int FROM organization_units unit
      WHERE unit.organization_id=type.organization_id AND unit.unit_type_id=type.id) AS usage_count
  FROM organization_unit_types type
  JOIN organizations organization ON organization.id=type.organization_id`;

/** Mengubah pelanggaran kode atau nama unik menjadi respons publik yang stabil. */
const mapUniqueViolation = (error) => {
  if (error?.code === "23505")
    throw new ServiceError(
      "DUPLICATE_ORGANIZATION_UNIT_TYPE",
      "Kode atau nama jenis unit sudah digunakan pada organisasi ini.",
      409,
    );
  throw error;
};

/** Mengambil daftar jenis unit sesuai filter dan scope organisasi. */
export async function listOrganizationUnitTypes({
  search,
  status,
  page,
  pageSize,
  organizationId,
}) {
  const offset = (page - 1) * pageSize;
  const params = [`%${search}%`, status, organizationId || null, pageSize, offset];
  const where = `WHERE ($1='' OR type.code ILIKE $1 OR type.name ILIKE $1
      OR COALESCE(type.description,'') ILIKE $1 OR organization.name ILIKE $1)
    AND ($2='all' OR type.is_active=($2='active'))
    AND ($3::bigint IS NULL OR type.organization_id=$3)`;
  const [rows, count] = await Promise.all([
    pool.query(
      `${typeSelect} ${where} ORDER BY type.sort_order,type.name LIMIT $4 OFFSET $5`,
      params,
    ),
    pool.query(
      `SELECT count(*)::int AS total FROM organization_unit_types type
        JOIN organizations organization ON organization.id=type.organization_id ${where}`,
      params.slice(0, 3),
    ),
  ]);
  return { data: rows.rows, total: count.rows[0].total };
}

/** Mengambil satu jenis unit dan menegakkan scope organisasi bila diberikan. */
export async function getOrganizationUnitType(id, organizationId = null, database = pool) {
  const result = await database.query(
    `${typeSelect} WHERE type.id=$1
      AND ($2::bigint IS NULL OR type.organization_id=$2)`,
    [id, organizationId],
  );
  if (!result.rows[0])
    throw new ServiceError("NOT_FOUND", "Jenis unit organisasi tidak ditemukan.", 404);
  return result.rows[0];
}

/** Menyediakan jenis aktif dan pilihan lama tertentu untuk form edit. */
export async function getOrganizationUnitTypeOptions(organizationId, includeId = null) {
  const result = await pool.query(
    `SELECT id::text,code,name,is_active FROM organization_unit_types
      WHERE organization_id=$1 AND (is_active=true OR id=$2)
      ORDER BY sort_order,name`,
    [organizationId, includeId],
  );
  return result.rows;
}

/** Membuat jenis unit pada organisasi yang telah diverifikasi. */
export async function createOrganizationUnitType(input, actor, requestId) {
  try {
    return await withTransaction(async (client) => {
      await ensureActiveOrganization(client, input.organizationId);
      const inserted = await client.query(
        `INSERT INTO organization_unit_types
          (organization_id,code,name,description,sort_order,is_active)
          VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [
          input.organizationId,
          input.code,
          input.name,
          input.description,
          input.sortOrder,
          input.isActive,
        ],
      );
      const id = inserted.rows[0].id;
      await writeAudit(client, {
        organizationId: input.organizationId,
        actorUserId: actor.id,
        action: "organization_unit_type.create",
        entityType: "organization_unit_type",
        entityId: id,
        afterData: input,
        requestId,
      });
      return getOrganizationUnitType(id, input.organizationId, client);
    });
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    mapUniqueViolation(error);
  }
}

/** Memperbarui jenis unit dan mengunci kode setelah jenis digunakan. */
export async function updateOrganizationUnitType(id, input, actor, requestId) {
  try {
    return await withTransaction(async (client) => {
      const beforeResult = await client.query(
        `SELECT type.*,(SELECT count(*)::int FROM organization_units unit
          WHERE unit.organization_id=type.organization_id AND unit.unit_type_id=type.id) AS usage_count
          FROM organization_unit_types type
          WHERE type.id=$1 AND type.organization_id=$2 FOR UPDATE`,
        [id, input.organizationId],
      );
      const before = beforeResult.rows[0];
      if (!before)
        throw new ServiceError("NOT_FOUND", "Jenis unit organisasi tidak ditemukan.", 404);
      if (
        isOrganizationUnitTypeCodeLocked({
          usageCount: before.usage_count,
          currentCode: before.code,
          nextCode: input.code,
        })
      )
        throw new ServiceError(
          "ORGANIZATION_UNIT_TYPE_CODE_LOCKED",
          "Kode tidak dapat diubah karena jenis unit sudah digunakan.",
          409,
          { code: "Kode dikunci setelah jenis unit digunakan." },
        );
      const updated = await client.query(
        `UPDATE organization_unit_types
          SET code=$3,name=$4,description=$5,sort_order=$6,is_active=$7
          WHERE id=$1 AND organization_id=$2
          AND date_trunc('milliseconds',updated_at)=date_trunc('milliseconds',$8::timestamptz)
          RETURNING id`,
        [
          id,
          input.organizationId,
          input.code,
          input.name,
          input.description,
          input.sortOrder,
          input.isActive,
          input.version,
        ],
      );
      if (!updated.rowCount)
        throw new ServiceError(
          "VERSION_CONFLICT",
          "Data telah berubah. Muat ulang sebelum menyimpan.",
          409,
        );
      await writeAudit(client, {
        organizationId: input.organizationId,
        actorUserId: actor.id,
        action: "organization_unit_type.update",
        entityType: "organization_unit_type",
        entityId: id,
        beforeData: before,
        afterData: { ...input, version: undefined },
        requestId,
      });
      return getOrganizationUnitType(id, input.organizationId, client);
    });
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    mapUniqueViolation(error);
  }
}

/** Menonaktifkan jenis tanpa mengubah unit yang sudah mereferensikannya. */
export async function deactivateOrganizationUnitType(id, organizationId, actor, requestId) {
  return withTransaction(async (client) => {
    const beforeResult = await client.query(
      `SELECT * FROM organization_unit_types WHERE id=$1
        AND ($2::bigint IS NULL OR organization_id=$2) FOR UPDATE`,
      [id, organizationId],
    );
    const before = beforeResult.rows[0];
    if (!before) throw new ServiceError("NOT_FOUND", "Jenis unit organisasi tidak ditemukan.", 404);
    await client.query("UPDATE organization_unit_types SET is_active=false WHERE id=$1", [id]);
    await writeAudit(client, {
      organizationId: before.organization_id,
      actorUserId: actor.id,
      action: "organization_unit_type.deactivate",
      entityType: "organization_unit_type",
      entityId: id,
      beforeData: before,
      afterData: { ...before, is_active: false },
      requestId,
    });
    return getOrganizationUnitType(id, organizationId, client);
  });
}
