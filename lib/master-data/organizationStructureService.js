import pool from "@/lib/dbConfig";
import { withTransaction } from "@/lib/dbTransaction";
import { writeAudit } from "@/lib/audit";
import { ServiceError } from "@/lib/api/routeHelpers";
import { ensureActiveOrganization } from "@/lib/master-data/guards";
import { canAssignOrganizationUnitType } from "@/lib/master-data/organizationUnitTypeRules.mjs";

const unitSelect = `
  SELECT unit.id::text,unit.organization_id::text,organization.name AS organization_name,
    unit.parent_unit_id::text,parent.name AS parent_unit_name,unit.code,unit.name,
    unit.unit_type_id::text,unit_type.code AS unit_type_code,unit_type.name AS unit_type_name,
    unit_type.is_active AS unit_type_is_active,unit.is_active,unit.updated_at,
    COALESCE(json_agg(json_build_object('id',location.id::text,'code',location.code,'name',location.name,
      'active_from',mapping.active_from::text,'active_until',mapping.active_until::text)
      ORDER BY location.name) FILTER (WHERE location.id IS NOT NULL),'[]'::json) AS locations
  FROM organization_units unit
  JOIN organizations organization ON organization.id=unit.organization_id
  JOIN organization_unit_types unit_type
    ON unit_type.organization_id=unit.organization_id AND unit_type.id=unit.unit_type_id
  LEFT JOIN organization_units parent
    ON parent.organization_id=unit.organization_id AND parent.id=unit.parent_unit_id
  LEFT JOIN organization_unit_locations mapping
    ON mapping.organization_id=unit.organization_id AND mapping.organization_unit_id=unit.id
    AND mapping.active_from<=current_date
    AND (mapping.active_until IS NULL OR mapping.active_until>=current_date)
  LEFT JOIN locations location
    ON location.organization_id=mapping.organization_id AND location.id=mapping.location_id`;

const positionSelect = `
  SELECT position.id::text,position.organization_id::text,organization.name AS organization_name,
    position.code,position.name,position.grade,position.level_no,position.is_managerial,
    position.is_active,position.updated_at,
    (SELECT count(DISTINCT assignment.employee_id)::int FROM employee_assignments assignment
      WHERE assignment.organization_id=position.organization_id AND assignment.position_id=position.id
      AND assignment.effective_from<=current_date
      AND (assignment.effective_until IS NULL OR assignment.effective_until>=current_date)) AS employee_count
  FROM positions position
  JOIN organizations organization ON organization.id=position.organization_id`;

const employmentTypeSelect = `
  SELECT employment_type.id::text,employment_type.organization_id::text,
    organization.name AS organization_name,employment_type.code,employment_type.name,
    employment_type.requires_end_date,employment_type.is_active,employment_type.updated_at,
    (SELECT count(*)::int FROM employment_contracts contract
      WHERE contract.organization_id=employment_type.organization_id
      AND contract.employment_type_id=employment_type.id
      AND contract.status IN ('draft','active')) AS contract_count
  FROM employment_types employment_type
  JOIN organizations organization ON organization.id=employment_type.organization_id`;

/** Mengubah pelanggaran kode unik menjadi error publik yang stabil. */
const mapUniqueViolation = (error, message) => {
  if (error?.code === "23P01" || error?.constraint === "organization_unit_locations_pkey")
    throw new ServiceError(
      "UNIT_LOCATION_PERIOD_OVERLAP",
      "Periode lokasi pada Divisi atau Unit tidak boleh saling bertumpang tindih.",
      409,
    );
  if (error?.code === "23505") throw new ServiceError("DUPLICATE_CODE", message, 409);
  throw error;
};

/** Memastikan setiap periode lokasi valid, aktif, dan berasal dari organisasi yang sama. */
const validateUnitLocations = async (client, organizationId, locations) => {
  const uniqueIds = [...new Set(locations.map((location) => String(location.locationId)))];
  if (!uniqueIds.length) return [];

  const result = await client.query(
    `SELECT id::text,operational_from::text,operational_until::text,is_active,
      current_date::text AS today
     FROM locations
     WHERE organization_id=$1 AND id=ANY($2::bigint[]) FOR SHARE`,
    [organizationId, uniqueIds],
  );
  if (result.rowCount !== uniqueIds.length)
    throw new ServiceError(
      "LOCATION_INVALID",
      "Semua lokasi unit harus berasal dari organisasi yang sama.",
      400,
    );

  const references = new Map(result.rows.map((row) => [row.id, row]));
  return locations.map((location, index) => {
    const reference = references.get(String(location.locationId));
    const field = `locations.${index}.activeFrom`;
    if (!reference.is_active)
      throw new ServiceError("LOCATION_INACTIVE", "Lokasi yang dipilih sudah tidak aktif.", 409);
    if (location.activeFrom > reference.today)
      throw new ServiceError(
        "UNIT_LOCATION_DATE_IN_FUTURE",
        "Tanggal mulai lokasi unit tidak boleh melewati hari ini.",
        400,
        { [field]: "Tanggal mulai tidak boleh melewati hari ini." },
      );
    if (
      location.activeFrom < reference.operational_from ||
      (reference.operational_until && location.activeFrom > reference.operational_until)
    )
      throw new ServiceError(
        "UNIT_LOCATION_OUTSIDE_OPERATIONAL_PERIOD",
        "Tanggal mulai unit harus berada dalam masa operasional lokasi.",
        400,
        { [field]: "Sesuaikan tanggal dengan masa operasional lokasi." },
      );
    if (reference.operational_until && reference.operational_until < reference.today)
      throw new ServiceError(
        "LOCATION_NOT_OPERATIONAL",
        "Lokasi yang dipilih sudah tidak berada dalam masa operasional.",
        409,
      );
    return {
      locationId: String(location.locationId),
      activeFrom: location.activeFrom,
    };
  });
};

/** Menolak parent lintas organisasi, parent diri sendiri, dan siklus hierarki unit. */
const ensureUnitParent = async (client, { id, organizationId, parentUnitId }) => {
  if (!parentUnitId) return;
  if (String(id || "") === String(parentUnitId))
    throw new ServiceError("INVALID_HIERARCHY", "Unit tidak dapat menjadi induknya sendiri.", 400);

  const result = await client.query(
    `WITH RECURSIVE descendants AS (
      SELECT child.id FROM organization_units child
      WHERE child.organization_id=$1 AND child.parent_unit_id=$2
      UNION ALL
      SELECT child.id FROM organization_units child
      JOIN descendants descendant ON child.parent_unit_id=descendant.id
      WHERE child.organization_id=$1
    )
    SELECT EXISTS(SELECT 1 FROM organization_units WHERE organization_id=$1 AND id=$3) AS parent_exists,
      EXISTS(SELECT 1 FROM descendants WHERE id=$3) AS cycle`,
    [organizationId, id || 0, parentUnitId],
  );
  if (!result.rows[0].parent_exists)
    throw new ServiceError("PARENT_NOT_FOUND", "Unit induk tidak ditemukan.", 404);
  if (result.rows[0].cycle)
    throw new ServiceError("INVALID_HIERARCHY", "Hierarki unit membentuk siklus.", 409);
};

/** Memastikan jenis unit berasal dari organisasi yang sama dan layak dipilih. */
const ensureUnitType = async (client, { organizationId, unitTypeId, currentUnitTypeId = null }) => {
  const result = await client.query(
    `SELECT id,is_active FROM organization_unit_types
      WHERE organization_id=$1 AND id=$2 FOR SHARE`,
    [organizationId, unitTypeId],
  );
  const type = result.rows[0];
  if (!type)
    throw new ServiceError(
      "ORGANIZATION_UNIT_TYPE_NOT_FOUND",
      "Jenis unit tidak ditemukan pada organisasi ini.",
      400,
      { unitTypeId: "Jenis unit tidak valid." },
    );
  if (
    !canAssignOrganizationUnitType({
      isActive: type.is_active,
      typeId: unitTypeId,
      currentTypeId: currentUnitTypeId,
    })
  )
    throw new ServiceError(
      "ORGANIZATION_UNIT_TYPE_INACTIVE",
      "Jenis unit sudah tidak aktif dan tidak dapat dipilih.",
      409,
      { unitTypeId: "Pilih jenis unit yang masih aktif." },
    );
};

/** Menjaga histori periode lokasi serta menolak perubahan yang merusak penempatan. */
const synchronizeUnitLocations = async (
  client,
  organizationId,
  unitId,
  locations,
  locationChangeReason,
) => {
  const current = await client.query(
    `SELECT location_id::text,active_from::text,active_until::text,
      current_date::text AS today
     FROM organization_unit_locations
     WHERE organization_id=$1 AND organization_unit_id=$2
       AND active_from<=current_date
       AND (active_until IS NULL OR active_until>=current_date)
     FOR UPDATE`,
    [organizationId, unitId],
  );
  const desired = new Map(locations.map((location) => [location.locationId, location]));
  const existing = new Map(current.rows.map((row) => [row.location_id, row]));
  const historicalChanges = current.rows.filter((row) => {
    const next = desired.get(row.location_id);
    return !next || next.activeFrom !== row.active_from;
  });

  if (historicalChanges.length && String(locationChangeReason || "").trim().length < 5)
    throw new ServiceError(
      "UNIT_LOCATION_REASON_REQUIRED",
      "Alasan koreksi atau pelepasan lokasi wajib diisi minimal 5 karakter.",
      400,
      { locationChangeReason: "Alasan wajib diisi minimal 5 karakter." },
    );

  for (const row of current.rows) {
    const next = desired.get(row.location_id);
    if (!next) {
      const impacted = await client.query(
        `SELECT 1 FROM employee_assignments
         WHERE organization_id=$1 AND organization_unit_id=$2 AND location_id=$3
           AND (effective_until IS NULL OR effective_until>=current_date)
         LIMIT 1 FOR UPDATE`,
        [organizationId, unitId, row.location_id],
      );
      if (impacted.rowCount)
        throw new ServiceError(
          "UNIT_LOCATION_IN_USE",
          "Lokasi tidak dapat dilepas karena masih digunakan oleh penempatan aktif atau mendatang.",
          409,
        );

      if (row.active_from === row.today)
        await client.query(
          `DELETE FROM organization_unit_locations
           WHERE organization_id=$1 AND organization_unit_id=$2
             AND location_id=$3 AND active_from=$4`,
          [organizationId, unitId, row.location_id, row.active_from],
        );
      else
        await client.query(
          `UPDATE organization_unit_locations SET active_until=current_date-1
           WHERE organization_id=$1 AND organization_unit_id=$2
             AND location_id=$3 AND active_from=$4`,
          [organizationId, unitId, row.location_id, row.active_from],
        );
      continue;
    }

    if (next.activeFrom !== row.active_from) {
      if (next.activeFrom > row.active_from) {
        const impacted = await client.query(
          `SELECT 1 FROM employee_assignments
           WHERE organization_id=$1 AND organization_unit_id=$2 AND location_id=$3
             AND effective_from<$4::date
             AND (effective_until IS NULL OR effective_until>=$5::date)
           LIMIT 1 FOR UPDATE`,
          [organizationId, unitId, row.location_id, next.activeFrom, row.active_from],
        );
        if (impacted.rowCount)
          throw new ServiceError(
            "UNIT_LOCATION_DATE_IN_USE",
            "Tanggal mulai tidak dapat dimajukan karena akan membuat histori penempatan menjadi tidak valid.",
            409,
          );
      }
      await client.query(
        `UPDATE organization_unit_locations SET active_from=$5
         WHERE organization_id=$1 AND organization_unit_id=$2
           AND location_id=$3 AND active_from=$4`,
        [organizationId, unitId, row.location_id, row.active_from, next.activeFrom],
      );
    }
  }

  for (const location of locations) {
    if (existing.has(location.locationId)) continue;
    await client.query(
      `INSERT INTO organization_unit_locations
        (organization_id,organization_unit_id,location_id,active_from)
       VALUES ($1,$2,$3,$4)`,
      [organizationId, unitId, location.locationId, location.activeFrom],
    );
  }
};

/** Mengambil daftar Divisi & Unit dengan filter organisasi dan pagination master kecil. */
export async function listOrganizationUnits({ search, status, page, pageSize, organizationId }) {
  const offset = (page - 1) * pageSize;
  const params = [`%${search}%`, status, organizationId || null, pageSize, offset];
  const where = `WHERE ($1='' OR unit.code ILIKE $1 OR unit.name ILIKE $1
      OR unit_type.code ILIKE $1 OR unit_type.name ILIKE $1 OR organization.name ILIKE $1)
    AND ($2='all' OR unit.is_active=($2='active'))
    AND ($3::bigint IS NULL OR unit.organization_id=$3)`;
  const group = "GROUP BY unit.id,organization.name,parent.name,unit_type.id";
  const [rows, count] = await Promise.all([
    pool.query(`${unitSelect} ${where} ${group} ORDER BY unit.name LIMIT $4 OFFSET $5`, params),
    pool.query(
      `SELECT count(*)::int AS total FROM organization_units unit
        JOIN organizations organization ON organization.id=unit.organization_id
        JOIN organization_unit_types unit_type
          ON unit_type.organization_id=unit.organization_id AND unit_type.id=unit.unit_type_id
        ${where}`,
      params.slice(0, 3),
    ),
  ]);
  return { data: rows.rows, total: count.rows[0].total };
}

/** Menyediakan pilihan unit aktif untuk parent selector pada organisasi yang sama. */
export async function getOrganizationUnitOptions(organizationId) {
  const result = await pool.query(
    `SELECT unit.id::text,unit.code,unit.name,unit.unit_type_id::text,
      type.name AS unit_type_name
      FROM organization_units unit
      JOIN organization_unit_types type
        ON type.organization_id=unit.organization_id AND type.id=unit.unit_type_id
      WHERE unit.organization_id=$1 AND unit.is_active=true ORDER BY unit.name`,
    [organizationId],
  );
  return result.rows;
}

/** Mengambil satu unit dan menegakkan filter organisasi bila diberikan. */
export async function getOrganizationUnit(id, organizationId = null, database = pool) {
  const result = await database.query(
    `${unitSelect} WHERE unit.id=$1 AND ($2::bigint IS NULL OR unit.organization_id=$2)
      GROUP BY unit.id,organization.name,parent.name,unit_type.id`,
    [id, organizationId],
  );
  if (!result.rows[0])
    throw new ServiceError("NOT_FOUND", "Divisi atau unit tidak ditemukan.", 404);
  return result.rows[0];
}

/** Membuat unit beserta pemetaan lokasi dalam satu transaksi. */
export async function createOrganizationUnit(input, actor, requestId) {
  try {
    return await withTransaction(async (client) => {
      await ensureActiveOrganization(client, input.organizationId);
      await ensureUnitParent(client, {
        organizationId: input.organizationId,
        parentUnitId: input.parentUnitId,
      });
      await ensureUnitType(client, {
        organizationId: input.organizationId,
        unitTypeId: input.unitTypeId,
      });
      const locations = await validateUnitLocations(client, input.organizationId, input.locations);
      const inserted = await client.query(
        `INSERT INTO organization_units
          (organization_id,parent_unit_id,code,name,unit_type_id,is_active)
          VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [
          input.organizationId,
          input.parentUnitId,
          input.code,
          input.name,
          input.unitTypeId,
          input.isActive,
        ],
      );
      const id = inserted.rows[0].id;
      await synchronizeUnitLocations(
        client,
        input.organizationId,
        id,
        locations,
        input.locationChangeReason,
      );
      await writeAudit(client, {
        organizationId: input.organizationId,
        actorUserId: actor.id,
        action: "organization_unit.create",
        entityType: "organization_unit",
        entityId: id,
        afterData: input,
        requestId,
      });
      return getOrganizationUnit(id, input.organizationId, client);
    });
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    mapUniqueViolation(error, "Kode divisi atau unit sudah digunakan.");
  }
}

/** Memperbarui unit dengan optimistic concurrency dan histori pemetaan lokasi. */
export async function updateOrganizationUnit(id, input, actor, requestId) {
  try {
    return await withTransaction(async (client) => {
      const before = await client.query(
        `SELECT * FROM organization_units
          WHERE id=$1 AND organization_id=$2 FOR UPDATE`,
        [id, input.organizationId],
      );
      if (!before.rows[0])
        throw new ServiceError("NOT_FOUND", "Divisi atau unit tidak ditemukan.", 404);
      const beforeLocations = await client.query(
        `SELECT location_id::text AS "locationId",active_from::text AS "activeFrom",
          active_until::text AS "activeUntil"
         FROM organization_unit_locations
         WHERE organization_id=$1 AND organization_unit_id=$2
           AND active_from<=current_date
           AND (active_until IS NULL OR active_until>=current_date)
         ORDER BY location_id FOR UPDATE`,
        [input.organizationId, id],
      );
      await ensureUnitParent(client, {
        id,
        organizationId: input.organizationId,
        parentUnitId: input.parentUnitId,
      });
      await ensureUnitType(client, {
        organizationId: input.organizationId,
        unitTypeId: input.unitTypeId,
        currentUnitTypeId: before.rows[0].unit_type_id,
      });
      const locations = await validateUnitLocations(client, input.organizationId, input.locations);
      const updated = await client.query(
        `UPDATE organization_units
          SET parent_unit_id=$3,code=$4,name=$5,unit_type_id=$6,is_active=$7
          WHERE id=$1 AND organization_id=$2
          AND date_trunc('milliseconds',updated_at)=date_trunc('milliseconds',$8::timestamptz)
          RETURNING id`,
        [
          id,
          input.organizationId,
          input.parentUnitId,
          input.code,
          input.name,
          input.unitTypeId,
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
      await synchronizeUnitLocations(
        client,
        input.organizationId,
        id,
        locations,
        input.locationChangeReason,
      );
      await writeAudit(client, {
        organizationId: input.organizationId,
        actorUserId: actor.id,
        action: "organization_unit.update",
        entityType: "organization_unit",
        entityId: id,
        beforeData: { ...before.rows[0], locations: beforeLocations.rows },
        afterData: { ...input, version: undefined },
        requestId,
      });
      return getOrganizationUnit(id, input.organizationId, client);
    });
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    mapUniqueViolation(error, "Kode divisi atau unit sudah digunakan.");
  }
}

/** Menonaktifkan unit tanpa menghapus histori penempatan pegawai. */
export async function deactivateOrganizationUnit(id, organizationId, actor, requestId) {
  return withTransaction(async (client) => {
    const before = await client.query(
      `SELECT * FROM organization_units
        WHERE id=$1 AND ($2::bigint IS NULL OR organization_id=$2) FOR UPDATE`,
      [id, organizationId],
    );
    if (!before.rows[0])
      throw new ServiceError("NOT_FOUND", "Divisi atau unit tidak ditemukan.", 404);
    await client.query("UPDATE organization_units SET is_active=false WHERE id=$1", [id]);
    await writeAudit(client, {
      organizationId: before.rows[0].organization_id,
      actorUserId: actor.id,
      action: "organization_unit.deactivate",
      entityType: "organization_unit",
      entityId: id,
      beforeData: before.rows[0],
      afterData: { ...before.rows[0], is_active: false },
      requestId,
    });
    return getOrganizationUnit(id, organizationId, client);
  });
}

/** Mengambil daftar jabatan sesuai organisasi yang boleh dikelola actor. */
export async function listPositions({ search, status, page, pageSize, organizationId }) {
  const offset = (page - 1) * pageSize;
  const params = [`%${search}%`, status, organizationId || null, pageSize, offset];
  const where = `WHERE ($1='' OR position.code ILIKE $1 OR position.name ILIKE $1
      OR COALESCE(position.grade,'') ILIKE $1 OR organization.name ILIKE $1)
    AND ($2='all' OR position.is_active=($2='active'))
    AND ($3::bigint IS NULL OR position.organization_id=$3)`;
  const [rows, count] = await Promise.all([
    pool.query(
      `${positionSelect} ${where} ORDER BY position.level_no NULLS LAST,position.name LIMIT $4 OFFSET $5`,
      params,
    ),
    pool.query(
      `SELECT count(*)::int AS total FROM positions position
        JOIN organizations organization ON organization.id=position.organization_id ${where}`,
      params.slice(0, 3),
    ),
  ]);
  return { data: rows.rows, total: count.rows[0].total };
}

/** Mengambil satu jabatan dengan filter organisasi. */
export async function getPosition(id, organizationId = null, database = pool) {
  const result = await database.query(
    `${positionSelect} WHERE position.id=$1
      AND ($2::bigint IS NULL OR position.organization_id=$2)`,
    [id, organizationId],
  );
  if (!result.rows[0]) throw new ServiceError("NOT_FOUND", "Jabatan tidak ditemukan.", 404);
  return result.rows[0];
}

/** Membuat jabatan baru pada organisasi terverifikasi. */
export async function createPosition(input, actor, requestId) {
  try {
    return await withTransaction(async (client) => {
      await ensureActiveOrganization(client, input.organizationId);
      const inserted = await client.query(
        `INSERT INTO positions
          (organization_id,code,name,grade,level_no,is_managerial,is_active)
          VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [
          input.organizationId,
          input.code,
          input.name,
          input.grade,
          input.levelNo,
          input.isManagerial,
          input.isActive,
        ],
      );
      const id = inserted.rows[0].id;
      await writeAudit(client, {
        organizationId: input.organizationId,
        actorUserId: actor.id,
        action: "position.create",
        entityType: "position",
        entityId: id,
        afterData: input,
        requestId,
      });
      return getPosition(id, input.organizationId, client);
    });
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    mapUniqueViolation(error, "Kode jabatan sudah digunakan.");
  }
}

/** Memperbarui jabatan menggunakan versi updated_at dari form. */
export async function updatePosition(id, input, actor, requestId) {
  try {
    return await withTransaction(async (client) => {
      const before = await client.query(
        "SELECT * FROM positions WHERE id=$1 AND organization_id=$2 FOR UPDATE",
        [id, input.organizationId],
      );
      if (!before.rows[0]) throw new ServiceError("NOT_FOUND", "Jabatan tidak ditemukan.", 404);
      const updated = await client.query(
        `UPDATE positions SET code=$3,name=$4,grade=$5,level_no=$6,is_managerial=$7,is_active=$8
          WHERE id=$1 AND organization_id=$2
          AND date_trunc('milliseconds',updated_at)=date_trunc('milliseconds',$9::timestamptz)
          RETURNING id`,
        [
          id,
          input.organizationId,
          input.code,
          input.name,
          input.grade,
          input.levelNo,
          input.isManagerial,
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
        action: "position.update",
        entityType: "position",
        entityId: id,
        beforeData: before.rows[0],
        afterData: { ...input, version: undefined },
        requestId,
      });
      return getPosition(id, input.organizationId, client);
    });
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    mapUniqueViolation(error, "Kode jabatan sudah digunakan.");
  }
}

/** Menonaktifkan jabatan sambil mempertahankan histori assignment. */
export async function deactivatePosition(id, organizationId, actor, requestId) {
  return deactivateSimpleMaster({
    table: "positions",
    entityType: "position",
    action: "position.deactivate",
    notFoundMessage: "Jabatan tidak ditemukan.",
    id,
    organizationId,
    actor,
    requestId,
    getter: getPosition,
  });
}

/** Mengambil daftar jenis kepegawaian organisasi. */
export async function listEmploymentTypes({ search, status, page, pageSize, organizationId }) {
  const offset = (page - 1) * pageSize;
  const params = [`%${search}%`, status, organizationId || null, pageSize, offset];
  const where = `WHERE ($1='' OR employment_type.code ILIKE $1 OR employment_type.name ILIKE $1
      OR organization.name ILIKE $1)
    AND ($2='all' OR employment_type.is_active=($2='active'))
    AND ($3::bigint IS NULL OR employment_type.organization_id=$3)`;
  const [rows, count] = await Promise.all([
    pool.query(
      `${employmentTypeSelect} ${where} ORDER BY employment_type.name LIMIT $4 OFFSET $5`,
      params,
    ),
    pool.query(
      `SELECT count(*)::int AS total FROM employment_types employment_type
        JOIN organizations organization ON organization.id=employment_type.organization_id ${where}`,
      params.slice(0, 3),
    ),
  ]);
  return { data: rows.rows, total: count.rows[0].total };
}

/** Mengambil satu jenis kepegawaian dengan filter organisasi. */
export async function getEmploymentType(id, organizationId = null, database = pool) {
  const result = await database.query(
    `${employmentTypeSelect} WHERE employment_type.id=$1
      AND ($2::bigint IS NULL OR employment_type.organization_id=$2)`,
    [id, organizationId],
  );
  if (!result.rows[0])
    throw new ServiceError("NOT_FOUND", "Jenis kepegawaian tidak ditemukan.", 404);
  return result.rows[0];
}

/** Membuat jenis kepegawaian baru pada organisasi terverifikasi. */
export async function createEmploymentType(input, actor, requestId) {
  try {
    return await withTransaction(async (client) => {
      await ensureActiveOrganization(client, input.organizationId);
      const inserted = await client.query(
        `INSERT INTO employment_types
          (organization_id,code,name,requires_end_date,is_active)
          VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [input.organizationId, input.code, input.name, input.requiresEndDate, input.isActive],
      );
      const id = inserted.rows[0].id;
      await writeAudit(client, {
        organizationId: input.organizationId,
        actorUserId: actor.id,
        action: "employment_type.create",
        entityType: "employment_type",
        entityId: id,
        afterData: input,
        requestId,
      });
      return getEmploymentType(id, input.organizationId, client);
    });
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    mapUniqueViolation(error, "Kode jenis kepegawaian sudah digunakan.");
  }
}

/** Memperbarui jenis kepegawaian dengan optimistic concurrency. */
export async function updateEmploymentType(id, input, actor, requestId) {
  try {
    return await withTransaction(async (client) => {
      const before = await client.query(
        "SELECT * FROM employment_types WHERE id=$1 AND organization_id=$2 FOR UPDATE",
        [id, input.organizationId],
      );
      if (!before.rows[0])
        throw new ServiceError("NOT_FOUND", "Jenis kepegawaian tidak ditemukan.", 404);
      const updated = await client.query(
        `UPDATE employment_types SET code=$3,name=$4,requires_end_date=$5,is_active=$6
          WHERE id=$1 AND organization_id=$2
          AND date_trunc('milliseconds',updated_at)=date_trunc('milliseconds',$7::timestamptz)
          RETURNING id`,
        [
          id,
          input.organizationId,
          input.code,
          input.name,
          input.requiresEndDate,
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
        action: "employment_type.update",
        entityType: "employment_type",
        entityId: id,
        beforeData: before.rows[0],
        afterData: { ...input, version: undefined },
        requestId,
      });
      return getEmploymentType(id, input.organizationId, client);
    });
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    mapUniqueViolation(error, "Kode jenis kepegawaian sudah digunakan.");
  }
}

/** Menonaktifkan jenis kepegawaian tanpa menghapus kontrak yang sudah tercatat. */
export async function deactivateEmploymentType(id, organizationId, actor, requestId) {
  return deactivateSimpleMaster({
    table: "employment_types",
    entityType: "employment_type",
    action: "employment_type.deactivate",
    notFoundMessage: "Jenis kepegawaian tidak ditemukan.",
    id,
    organizationId,
    actor,
    requestId,
    getter: getEmploymentType,
  });
}

/** Menyatukan pola deaktivasi master sederhana dengan audit dan filter organisasi. */
async function deactivateSimpleMaster({
  table,
  entityType,
  action,
  notFoundMessage,
  id,
  organizationId,
  actor,
  requestId,
  getter,
}) {
  return withTransaction(async (client) => {
    const before = await client.query(
      `SELECT * FROM ${table} WHERE id=$1
        AND ($2::bigint IS NULL OR organization_id=$2) FOR UPDATE`,
      [id, organizationId],
    );
    if (!before.rows[0]) throw new ServiceError("NOT_FOUND", notFoundMessage, 404);
    await client.query(`UPDATE ${table} SET is_active=false WHERE id=$1`, [id]);
    await writeAudit(client, {
      organizationId: before.rows[0].organization_id,
      actorUserId: actor.id,
      action,
      entityType,
      entityId: id,
      beforeData: before.rows[0],
      afterData: { ...before.rows[0], is_active: false },
      requestId,
    });
    return getter(id, organizationId, client);
  });
}
