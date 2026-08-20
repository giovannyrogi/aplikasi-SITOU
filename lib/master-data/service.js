import bcrypt from "bcryptjs";
import pool from "@/lib/dbConfig";
import { writeAudit } from "@/lib/audit";
import { ServiceError } from "@/lib/api/routeHelpers";

const organizationSelect = `
  SELECT o.id::text, o.parent_id::text, parent.name AS parent_name, o.code, o.name,
    o.legal_name, o.organization_type, o.timezone, o.locale,
    o.active_from::text, o.active_until::text, o.is_active, o.updated_at,
    (SELECT count(*)::int FROM locations l WHERE l.organization_id=o.id AND l.is_active) AS location_count,
    (SELECT count(*)::int FROM user_organization_roles uor JOIN roles r ON r.id=uor.role_id
      WHERE uor.organization_id=o.id AND r.code='hrd' AND (uor.active_until IS NULL OR uor.active_until>now())) AS admin_count,
    (o.active_until - (now() AT TIME ZONE o.timezone)::date)::int AS days_remaining,
    CASE
      WHEN NOT o.is_active THEN 'inactive'
      WHEN (now() AT TIME ZONE o.timezone)::date < o.active_from THEN 'not_started'
      WHEN (now() AT TIME ZONE o.timezone)::date > o.active_until THEN 'expired'
      WHEN o.active_until - (now() AT TIME ZONE o.timezone)::date <= 7 THEN 'critical'
      WHEN o.active_until - (now() AT TIME ZONE o.timezone)::date <= 30 THEN 'expiring'
      ELSE 'active'
    END AS subscription_status
  FROM organizations o
  LEFT JOIN organizations parent ON parent.id=o.parent_id`;

const locationSelect = `
  SELECT l.id::text, l.organization_id::text, o.name AS organization_name,
    l.parent_location_id::text, parent.name AS parent_location_name,
    l.code, l.name, l.location_type, l.address, l.latitude::text, l.longitude::text,
    l.active_from::text, l.active_until::text, l.is_active, l.updated_at,
    (SELECT count(DISTINCT uls.user_organization_role_id)::int FROM user_location_scopes uls
      WHERE uls.organization_id=l.organization_id AND uls.location_id=l.id) AS admin_count
  FROM locations l
  JOIN organizations o ON o.id=l.organization_id
  LEFT JOIN locations parent ON parent.organization_id=l.organization_id AND parent.id=l.parent_location_id`;

const adminSelect = `
  SELECT u.id::text, u.username, u.email, u.full_name, u.phone, u.is_active,
    u.updated_at, u.last_login_at, uor.organization_id::text, o.name AS organization_name,
    COALESCE(json_agg(json_build_object('id',l.id::text,'name',l.name,'code',l.code)
      ORDER BY l.name) FILTER (WHERE l.id IS NOT NULL), '[]'::json) AS locations
  FROM users u
  JOIN user_organization_roles uor ON uor.user_id=u.id
  JOIN roles r ON r.id=uor.role_id AND r.code='hrd'
  JOIN organizations o ON o.id=uor.organization_id
  LEFT JOIN user_location_scopes uls ON uls.user_organization_role_id=uor.id
  LEFT JOIN locations l ON l.organization_id=uls.organization_id AND l.id=uls.location_id
`;

const normalizeAdminUser = (row) => ({
  ...row,
  location_ids: (row.locations || []).map((location) => location.id),
  location_names: (row.locations || []).map((location) => location.name),
});

const withTransaction = async (process) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await process(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const mapUniqueViolation = (error, fallbackCode, fallbackMessage) => {
  if (error?.code === "23505") throw new ServiceError(fallbackCode, fallbackMessage, 409);
  throw error;
};

const ensureOrganizationParent = async (client, organizationId, parentId) => {
  if (!parentId) return;
  if (Number(organizationId) === Number(parentId)) {
    throw new ServiceError(
      "INVALID_HIERARCHY",
      "Organisasi tidak dapat menjadi induknya sendiri.",
      400,
    );
  }
  const result = await client.query(
    `WITH RECURSIVE descendants AS (
      SELECT id FROM organizations WHERE parent_id=$1
      UNION ALL SELECT o.id FROM organizations o JOIN descendants d ON o.parent_id=d.id
    ) SELECT EXISTS(SELECT 1 FROM descendants WHERE id=$2) AS cycle,
      EXISTS(SELECT 1 FROM organizations WHERE id=$2) AS parent_exists`,
    [organizationId || 0, parentId],
  );
  if (!result.rows[0]?.parent_exists)
    throw new ServiceError("PARENT_NOT_FOUND", "Organisasi induk tidak ditemukan.", 404);
  if (result.rows[0]?.cycle)
    throw new ServiceError("INVALID_HIERARCHY", "Hierarki organisasi membentuk siklus.", 409);
};

export async function listOrganizations({ search, status, page, pageSize }) {
  const offset = (page - 1) * pageSize;
  const params = [`%${search}%`, status, pageSize, offset];
  const where = `WHERE ($1='' OR o.code ILIKE $1 OR o.name ILIKE $1 OR COALESCE(o.legal_name,'') ILIKE $1)
    AND ($2='all' OR o.is_active=($2='active'))`;
  const [rows, count] = await Promise.all([
    pool.query(
      `${organizationSelect} ${where} ORDER BY o.created_at DESC,o.id DESC LIMIT $3 OFFSET $4`,
      params,
    ),
    pool.query(`SELECT count(*)::int AS total FROM organizations o ${where}`, params.slice(0, 2)),
  ]);
  return { data: rows.rows, total: count.rows[0].total };
}

export async function getOrganizationOptions() {
  const result = await pool.query(
    `SELECT id::text, code, name, active_from::text, active_until::text, is_active
     FROM organizations ORDER BY name`,
  );
  return result.rows;
}

export async function getOrganization(id, database = pool) {
  const result = await database.query(`${organizationSelect} WHERE o.id=$1`, [id]);
  if (!result.rows[0]) throw new ServiceError("NOT_FOUND", "Organisasi tidak ditemukan.", 404);
  return result.rows[0];
}

export async function createOrganization(input, actor, requestId) {
  try {
    return await withTransaction(async (client) => {
      await ensureOrganizationParent(client, null, input.parentId);
      const inserted = await client.query(
        `INSERT INTO organizations (parent_id,code,name,legal_name,organization_type,timezone,active_from,active_until,is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
        [
          input.parentId,
          input.code,
          input.name,
          input.legalName,
          input.organizationType,
          input.timezone,
          input.activeFrom,
          input.activeUntil,
          input.isActive,
        ],
      );
      const id = inserted.rows[0].id;
      await writeAudit(client, {
        actorUserId: actor.id,
        action: "organization.create",
        entityType: "organization",
        entityId: id,
        afterData: { ...input, parentId: input.parentId || null },
        requestId,
      });
      return getOrganization(id, client);
    });
  } catch (error) {
    mapUniqueViolation(error, "DUPLICATE_CODE", "Kode organisasi sudah digunakan.");
  }
}

export async function updateOrganization(id, input, actor, requestId) {
  try {
    return await withTransaction(async (client) => {
      const before = await client.query("SELECT * FROM organizations WHERE id=$1 FOR UPDATE", [id]);
      if (!before.rows[0]) throw new ServiceError("NOT_FOUND", "Organisasi tidak ditemukan.", 404);
      await ensureOrganizationParent(client, id, input.parentId);
      const updated = await client.query(
        `UPDATE organizations SET parent_id=$2,code=$3,name=$4,legal_name=$5,organization_type=$6,
          timezone=$7,active_from=$8,active_until=$9,is_active=$10
         WHERE id=$1 AND date_trunc('milliseconds',updated_at)=date_trunc('milliseconds',$11::timestamptz) RETURNING id`,
        [
          id,
          input.parentId,
          input.code,
          input.name,
          input.legalName,
          input.organizationType,
          input.timezone,
          input.activeFrom,
          input.activeUntil,
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
        organizationId: id,
        actorUserId: actor.id,
        action: "organization.update",
        entityType: "organization",
        entityId: id,
        beforeData: before.rows[0],
        afterData: { ...input, version: undefined },
        requestId,
      });
      return getOrganization(id, client);
    });
  } catch (error) {
    mapUniqueViolation(error, "DUPLICATE_CODE", "Kode organisasi sudah digunakan.");
  }
}

export async function deactivateOrganization(id, actor, requestId) {
  return withTransaction(async (client) => {
    const before = await client.query(
      "SELECT id,code,name,is_active FROM organizations WHERE id=$1 FOR UPDATE",
      [id],
    );
    if (!before.rows[0]) throw new ServiceError("NOT_FOUND", "Organisasi tidak ditemukan.", 404);
    await client.query("UPDATE organizations SET is_active=false WHERE id=$1", [id]);
    await writeAudit(client, {
      organizationId: id,
      actorUserId: actor.id,
      action: "organization.deactivate",
      entityType: "organization",
      entityId: id,
      beforeData: before.rows[0],
      afterData: { ...before.rows[0], is_active: false },
      requestId,
    });
    return getOrganization(id, client);
  });
}

const ensureLocationParent = async (client, { id, organizationId, parentLocationId }) => {
  if (!parentLocationId) return;
  if (Number(id) === Number(parentLocationId))
    throw new ServiceError(
      "INVALID_HIERARCHY",
      "Lokasi tidak dapat menjadi induknya sendiri.",
      400,
    );
  const result = await client.query(
    `WITH RECURSIVE descendants AS (
      SELECT id FROM locations WHERE organization_id=$1 AND parent_location_id=$2
      UNION ALL SELECT l.id FROM locations l JOIN descendants d ON l.parent_location_id=d.id WHERE l.organization_id=$1
    ) SELECT EXISTS(SELECT 1 FROM descendants WHERE id=$3) AS cycle,
      EXISTS(SELECT 1 FROM locations WHERE organization_id=$1 AND id=$3) AS parent_exists`,
    [organizationId, id || 0, parentLocationId],
  );
  if (!result.rows[0].parent_exists)
    throw new ServiceError(
      "PARENT_NOT_FOUND",
      "Lokasi induk tidak ditemukan pada organisasi tersebut.",
      404,
    );
  if (result.rows[0].cycle)
    throw new ServiceError("INVALID_HIERARCHY", "Hierarki lokasi membentuk siklus.", 409);
};

export async function listLocations({ search, status, page, pageSize, organizationId }) {
  const offset = (page - 1) * pageSize;
  const params = [`%${search}%`, status, organizationId || null, pageSize, offset];
  const where = `WHERE ($1='' OR l.code ILIKE $1 OR l.name ILIKE $1 OR o.name ILIKE $1)
    AND ($2='all' OR l.is_active=($2='active')) AND ($3::bigint IS NULL OR l.organization_id=$3)`;
  const [rows, count] = await Promise.all([
    pool.query(
      `${locationSelect} ${where} ORDER BY l.created_at DESC,l.id DESC LIMIT $4 OFFSET $5`,
      params,
    ),
    pool.query(
      `SELECT count(*)::int AS total FROM locations l JOIN organizations o ON o.id=l.organization_id ${where}`,
      params.slice(0, 3),
    ),
  ]);
  return { data: rows.rows, total: count.rows[0].total };
}

export async function getLocationOptions(organizationId, activeOnly = true) {
  const result = await pool.query(
    `SELECT id::text,code,name,location_type,is_active FROM locations
     WHERE organization_id=$1 AND ($2=false OR is_active=true) ORDER BY name`,
    [organizationId, activeOnly],
  );
  return result.rows;
}

export async function getLocation(id, database = pool) {
  const result = await database.query(`${locationSelect} WHERE l.id=$1`, [id]);
  if (!result.rows[0]) throw new ServiceError("NOT_FOUND", "Lokasi tidak ditemukan.", 404);
  return result.rows[0];
}

export async function createLocation(input, actor, requestId) {
  try {
    return await withTransaction(async (client) => {
      const org = await client.query(
        "SELECT id FROM organizations WHERE id=$1 AND is_active FOR UPDATE",
        [input.organizationId],
      );
      if (!org.rows[0])
        throw new ServiceError(
          "ORGANIZATION_INACTIVE",
          "Organisasi tidak ditemukan atau tidak aktif.",
          409,
        );
      await ensureLocationParent(client, {
        organizationId: input.organizationId,
        parentLocationId: input.parentLocationId,
      });
      const inserted = await client.query(
        `INSERT INTO locations (organization_id,parent_location_id,code,name,location_type,address,latitude,longitude,active_from,active_until,is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
        [
          input.organizationId,
          input.parentLocationId,
          input.code,
          input.name,
          input.locationType,
          input.address,
          input.latitude,
          input.longitude,
          input.activeFrom,
          input.activeUntil,
          input.isActive,
        ],
      );
      const id = inserted.rows[0].id;
      await writeAudit(client, {
        organizationId: input.organizationId,
        actorUserId: actor.id,
        action: "location.create",
        entityType: "location",
        entityId: id,
        afterData: input,
        requestId,
      });
      return getLocation(id, client);
    });
  } catch (error) {
    mapUniqueViolation(
      error,
      "DUPLICATE_CODE",
      "Kode lokasi sudah digunakan pada organisasi tersebut.",
    );
  }
}

export async function updateLocation(id, input, actor, requestId) {
  try {
    return await withTransaction(async (client) => {
      const before = await client.query("SELECT * FROM locations WHERE id=$1 FOR UPDATE", [id]);
      if (!before.rows[0]) throw new ServiceError("NOT_FOUND", "Lokasi tidak ditemukan.", 404);
      if (Number(before.rows[0].organization_id) !== Number(input.organizationId))
        throw new ServiceError(
          "ORGANIZATION_IMMUTABLE",
          "Organisasi lokasi tidak dapat dipindahkan.",
          409,
        );
      await ensureLocationParent(client, {
        id,
        organizationId: input.organizationId,
        parentLocationId: input.parentLocationId,
      });
      const updated = await client.query(
        `UPDATE locations SET parent_location_id=$2,code=$3,name=$4,location_type=$5,address=$6,
          latitude=$7,longitude=$8,active_from=$9,active_until=$10,is_active=$11
         WHERE id=$1 AND date_trunc('milliseconds',updated_at)=date_trunc('milliseconds',$12::timestamptz) RETURNING id`,
        [
          id,
          input.parentLocationId,
          input.code,
          input.name,
          input.locationType,
          input.address,
          input.latitude,
          input.longitude,
          input.activeFrom,
          input.activeUntil,
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
        action: "location.update",
        entityType: "location",
        entityId: id,
        beforeData: before.rows[0],
        afterData: { ...input, version: undefined },
        requestId,
      });
      return getLocation(id, client);
    });
  } catch (error) {
    mapUniqueViolation(
      error,
      "DUPLICATE_CODE",
      "Kode lokasi sudah digunakan pada organisasi tersebut.",
    );
  }
}

export async function deactivateLocation(id, actor, requestId) {
  return withTransaction(async (client) => {
    const before = await client.query("SELECT * FROM locations WHERE id=$1 FOR UPDATE", [id]);
    if (!before.rows[0]) throw new ServiceError("NOT_FOUND", "Lokasi tidak ditemukan.", 404);
    const stranded = await client.query(
      `SELECT count(*)::int AS total FROM user_location_scopes current_scope
       JOIN user_organization_roles uor ON uor.id=current_scope.user_organization_role_id
       JOIN users u ON u.id=uor.user_id AND u.is_active
       WHERE current_scope.location_id=$1 AND current_scope.organization_id=$2
       AND NOT EXISTS (
         SELECT 1 FROM user_location_scopes other_scope
         JOIN locations other_location ON other_location.organization_id=other_scope.organization_id
           AND other_location.id=other_scope.location_id AND other_location.is_active
         WHERE other_scope.user_organization_role_id=current_scope.user_organization_role_id
           AND other_scope.location_id<>$1
       )`,
      [id, before.rows[0].organization_id],
    );
    if (stranded.rows[0].total > 0)
      throw new ServiceError(
        "LOCATION_IN_USE",
        "Lokasi ini merupakan akses terakhir bagi Admin/HRD aktif.",
        409,
      );
    await client.query("UPDATE locations SET is_active=false WHERE id=$1", [id]);
    await writeAudit(client, {
      organizationId: before.rows[0].organization_id,
      actorUserId: actor.id,
      action: "location.deactivate",
      entityType: "location",
      entityId: id,
      beforeData: before.rows[0],
      afterData: { ...before.rows[0], is_active: false },
      requestId,
    });
    return getLocation(id, client);
  });
}

export async function listAdminUsers({ search, status, page, pageSize, organizationId }) {
  const offset = (page - 1) * pageSize;
  const params = [`%${search}%`, status, organizationId || null, pageSize, offset];
  const where = `WHERE ($1='' OR u.username ILIKE $1 OR u.email ILIKE $1 OR u.full_name ILIKE $1 OR o.name ILIKE $1)
    AND ($2='all' OR u.is_active=($2='active')) AND ($3::bigint IS NULL OR uor.organization_id=$3)`;
  const group = "GROUP BY u.id,uor.organization_id,o.name";
  const [rows, count] = await Promise.all([
    pool.query(
      `${adminSelect} ${where} ${group} ORDER BY u.created_at DESC,u.id DESC LIMIT $4 OFFSET $5`,
      params,
    ),
    pool.query(
      `SELECT count(DISTINCT u.id)::int AS total FROM users u JOIN user_organization_roles uor ON uor.user_id=u.id JOIN roles r ON r.id=uor.role_id AND r.code='hrd' JOIN organizations o ON o.id=uor.organization_id ${where}`,
      params.slice(0, 3),
    ),
  ]);
  return { data: rows.rows.map(normalizeAdminUser), total: count.rows[0].total };
}

export async function getAdminUser(id, database = pool) {
  const result = await database.query(
    `${adminSelect} WHERE u.id=$1 GROUP BY u.id,uor.organization_id,o.name`,
    [id],
  );
  if (!result.rows[0]) throw new ServiceError("NOT_FOUND", "Admin/HRD tidak ditemukan.", 404);
  return normalizeAdminUser(result.rows[0]);
}

const validateAdminScope = async (client, organizationId, locationIds) => {
  const org = await client.query(
    `SELECT id FROM organizations WHERE id=$1 AND is_active
      AND (now() AT TIME ZONE timezone)::date BETWEEN active_from AND active_until FOR UPDATE`,
    [organizationId],
  );
  if (!org.rows[0])
    throw new ServiceError(
      "ORGANIZATION_UNAVAILABLE",
      "Organisasi tidak aktif atau masa berlakunya telah berakhir.",
      409,
    );
  const uniqueIds = [...new Set(locationIds.map(Number))];
  const locations = await client.query(
    "SELECT id FROM locations WHERE organization_id=$1 AND id=ANY($2::bigint[]) AND is_active FOR UPDATE",
    [organizationId, uniqueIds],
  );
  if (locations.rowCount !== uniqueIds.length)
    throw new ServiceError(
      "LOCATION_SCOPE_INVALID",
      "Semua lokasi harus aktif dan berasal dari organisasi yang dipilih.",
      400,
    );
  return uniqueIds;
};

export async function createAdminUser(input, actor, requestId) {
  try {
    return await withTransaction(async (client) => {
      const locationIds = await validateAdminScope(client, input.organizationId, input.locationIds);
      const role = await client.query(
        "SELECT id FROM roles WHERE code='hrd' AND scope='organization'",
        [],
      );
      if (!role.rows[0])
        throw new ServiceError("ROLE_NOT_CONFIGURED", "Role Admin/HRD belum tersedia.", 500);
      const hash = await bcrypt.hash(input.password, 12);
      const inserted = await client.query(
        `INSERT INTO users (username,email,password_hash,full_name,phone,is_active)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [input.username, input.email, hash, input.fullName, input.phone, input.isActive],
      );
      const userId = inserted.rows[0].id;
      const assignment = await client.query(
        `INSERT INTO user_organization_roles (user_id,organization_id,role_id,active_until,created_by_user_id)
         VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [
          userId,
          input.organizationId,
          role.rows[0].id,
          input.isActive ? null : new Date(),
          actor.id,
        ],
      );
      for (const locationId of locationIds) {
        await client.query(
          "INSERT INTO user_location_scopes (user_organization_role_id,organization_id,location_id) VALUES ($1,$2,$3)",
          [assignment.rows[0].id, input.organizationId, locationId],
        );
      }
      await writeAudit(client, {
        organizationId: input.organizationId,
        actorUserId: actor.id,
        action: "admin_user.create",
        entityType: "user",
        entityId: userId,
        afterData: {
          username: input.username,
          email: input.email,
          fullName: input.fullName,
          isActive: input.isActive,
          role: "hrd",
          locationIds,
        },
        requestId,
      });
      return getAdminUser(userId, client);
    });
  } catch (error) {
    mapUniqueViolation(error, "DUPLICATE_ACCOUNT", "Username atau email sudah digunakan.");
  }
}

export async function updateAdminUser(id, input, actor, requestId) {
  try {
    return await withTransaction(async (client) => {
      const before = await client.query(
        `SELECT u.id,u.username,u.email,u.full_name,u.phone,u.is_active,u.updated_at,uor.id AS role_id,uor.organization_id
         FROM users u JOIN user_organization_roles uor ON uor.user_id=u.id JOIN roles r ON r.id=uor.role_id AND r.code='hrd'
         WHERE u.id=$1 FOR UPDATE`,
        [id],
      );
      if (!before.rows[0]) throw new ServiceError("NOT_FOUND", "Admin/HRD tidak ditemukan.", 404);
      const organizationId = before.rows[0].organization_id;
      const locationIds = await validateAdminScope(client, organizationId, input.locationIds);
      const updated = await client.query(
        `UPDATE users SET username=$2,email=$3,full_name=$4,phone=$5,is_active=$6
         WHERE id=$1 AND date_trunc('milliseconds',updated_at)=date_trunc('milliseconds',$7::timestamptz) RETURNING id`,
        [
          id,
          input.username,
          input.email,
          input.fullName,
          input.phone,
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
      await client.query("UPDATE user_organization_roles SET active_until=$2 WHERE id=$1", [
        before.rows[0].role_id,
        input.isActive ? null : new Date(),
      ]);
      await client.query("DELETE FROM user_location_scopes WHERE user_organization_role_id=$1", [
        before.rows[0].role_id,
      ]);
      for (const locationId of locationIds) {
        await client.query(
          "INSERT INTO user_location_scopes (user_organization_role_id,organization_id,location_id) VALUES ($1,$2,$3)",
          [before.rows[0].role_id, organizationId, locationId],
        );
      }
      await writeAudit(client, {
        organizationId,
        actorUserId: actor.id,
        action: "admin_user.update",
        entityType: "user",
        entityId: id,
        beforeData: before.rows[0],
        afterData: {
          username: input.username,
          email: input.email,
          fullName: input.fullName,
          phone: input.phone,
          isActive: input.isActive,
          locationIds,
        },
        requestId,
      });
      return getAdminUser(id, client);
    });
  } catch (error) {
    mapUniqueViolation(error, "DUPLICATE_ACCOUNT", "Username atau email sudah digunakan.");
  }
}

export async function deactivateAdminUser(id, actor, requestId) {
  return withTransaction(async (client) => {
    const before = await client.query(
      `SELECT u.id,u.username,u.email,u.full_name,u.is_active,uor.id AS role_id,uor.organization_id
       FROM users u JOIN user_organization_roles uor ON uor.user_id=u.id JOIN roles r ON r.id=uor.role_id AND r.code='hrd'
       WHERE u.id=$1 FOR UPDATE`,
      [id],
    );
    if (!before.rows[0]) throw new ServiceError("NOT_FOUND", "Admin/HRD tidak ditemukan.", 404);
    await client.query("UPDATE users SET is_active=false WHERE id=$1", [id]);
    await client.query("UPDATE user_organization_roles SET active_until=now() WHERE id=$1", [
      before.rows[0].role_id,
    ]);
    await writeAudit(client, {
      organizationId: before.rows[0].organization_id,
      actorUserId: actor.id,
      action: "admin_user.deactivate",
      entityType: "user",
      entityId: id,
      beforeData: before.rows[0],
      afterData: { ...before.rows[0], is_active: false },
      requestId,
    });
    return getAdminUser(id, client);
  });
}

export async function resetAdminPassword(id, password, actor, requestId) {
  return withTransaction(async (client) => {
    const user = await client.query(
      `SELECT u.id,uor.organization_id FROM users u JOIN user_organization_roles uor ON uor.user_id=u.id
       JOIN roles r ON r.id=uor.role_id AND r.code='hrd' WHERE u.id=$1 FOR UPDATE`,
      [id],
    );
    if (!user.rows[0]) throw new ServiceError("NOT_FOUND", "Admin/HRD tidak ditemukan.", 404);
    await client.query("UPDATE users SET password_hash=$2 WHERE id=$1", [
      id,
      await bcrypt.hash(password, 12),
    ]);
    await writeAudit(client, {
      organizationId: user.rows[0].organization_id,
      actorUserId: actor.id,
      action: "admin_user.password_reset",
      entityType: "user",
      entityId: id,
      afterData: { passwordChanged: true },
      requestId,
    });
    return { id: String(id) };
  });
}
