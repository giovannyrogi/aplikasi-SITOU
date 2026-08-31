import pool from "@/lib/dbConfig";
import { writeAudit } from "@/lib/audit";
import { ServiceError } from "@/lib/api/routeHelpers";
import { effectiveSubscriptionStatusSql, insertSubscription } from "@/lib/subscriptions/service";
import { withTransaction } from "@/lib/dbTransaction";

const organizationSelect = `
  SELECT o.id::text, o.parent_id::text, parent.name AS parent_name, o.code, o.name,
    o.legal_name, o.organization_type, o.timezone, o.locale, o.is_active, o.updated_at,
    current_subscription.id::text AS subscription_id,
    current_subscription.starts_on::text AS subscription_starts_on,
    current_subscription.ends_on::text AS subscription_ends_on,
    current_subscription.grace_ends_on::text AS subscription_grace_ends_on,
    COALESCE(current_subscription.subscription_status,'no_subscription') AS subscription_status,
    current_subscription.days_remaining,
    (SELECT count(*)::int FROM locations l WHERE l.organization_id=o.id AND l.is_active) AS location_count,
    (SELECT count(*)::int FROM user_organization_roles uor JOIN roles r ON r.id=uor.role_id
      WHERE uor.organization_id=o.id AND r.code='hrd' AND (uor.active_until IS NULL OR uor.active_until>now())) AS admin_count
  FROM organizations o
  LEFT JOIN organizations parent ON parent.id=o.parent_id
  LEFT JOIN LATERAL (
    SELECT os.id,os.starts_on,os.ends_on,os.grace_ends_on,
      ${effectiveSubscriptionStatusSql()} AS subscription_status,
      (CASE WHEN (now() AT TIME ZONE o.timezone)::date<=os.ends_on THEN os.ends_on ELSE COALESCE(os.grace_ends_on,os.ends_on) END-(now() AT TIME ZONE o.timezone)::date)::int AS days_remaining
    FROM organization_subscriptions os WHERE os.organization_id=o.id
    ORDER BY CASE
      WHEN os.status NOT IN ('suspended','cancelled') AND (now() AT TIME ZONE o.timezone)::date BETWEEN os.starts_on AND COALESCE(os.grace_ends_on,os.ends_on) THEN 0
      WHEN os.status NOT IN ('suspended','cancelled') AND os.starts_on>(now() AT TIME ZONE o.timezone)::date THEN 1
      ELSE 2 END,os.starts_on DESC,os.id DESC LIMIT 1
  ) current_subscription ON true`;

const locationSelect = `
  SELECT l.id::text, l.organization_id::text, o.name AS organization_name,
    l.parent_location_id::text, parent.name AS parent_location_name,
    l.code, l.name, l.location_type, l.address, l.latitude::text, l.longitude::text,
    l.operational_from::text, l.operational_until::text, l.is_active, l.updated_at,
    (SELECT count(DISTINCT uls.user_organization_role_id)::int FROM user_location_scopes uls
      WHERE uls.organization_id=l.organization_id AND uls.location_id=l.id) AS admin_count
  FROM locations l
  JOIN organizations o ON o.id=l.organization_id
  LEFT JOIN locations parent ON parent.organization_id=l.organization_id AND parent.id=l.parent_location_id`;

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
  const result = await pool.query(`SELECT o.id::text,o.code,o.name,o.is_active,
    EXISTS (SELECT 1 FROM organization_subscriptions os WHERE os.organization_id=o.id
      AND os.status NOT IN ('suspended','cancelled')
      AND (now() AT TIME ZONE o.timezone)::date BETWEEN os.starts_on AND COALESCE(os.grace_ends_on,os.ends_on)) AS has_access
    FROM organizations o
    ORDER BY o.is_active DESC,has_access DESC,o.created_at,o.id`);
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
        `INSERT INTO organizations (parent_id,code,name,legal_name,organization_type,timezone,is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [
          input.parentId,
          input.code,
          input.name,
          input.legalName,
          input.organizationType,
          input.timezone,
          input.isActive,
        ],
      );
      const id = inserted.rows[0].id;
      const subscriptionId = await insertSubscription(client, {
        organizationId: id,
        input: input.initialSubscription,
        actor,
        requestId,
      });
      await writeAudit(client, {
        organizationId: id,
        actorUserId: actor.id,
        action: "organization.create",
        entityType: "organization",
        entityId: id,
        afterData: { ...input, parentId: input.parentId || null },
        requestId,
      });
      await writeAudit(client, {
        organizationId: id,
        actorUserId: actor.id,
        action: "organization_subscription.create",
        entityType: "organization_subscription",
        entityId: subscriptionId,
        afterData: { ...input.initialSubscription, initialPeriod: true },
        requestId,
      });
      return getOrganization(id, client);
    });
  } catch (error) {
    if (error instanceof ServiceError) throw error;
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
          timezone=$7,is_active=$8
         WHERE id=$1 AND date_trunc('milliseconds',updated_at)=date_trunc('milliseconds',$9::timestamptz) RETURNING id`,
        [
          id,
          input.parentId,
          input.code,
          input.name,
          input.legalName,
          input.organizationType,
          input.timezone,
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
    if (error instanceof ServiceError) throw error;
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
    `SELECT id::text,code,name,location_type,operational_from::text,operational_until::text,is_active FROM locations
     WHERE organization_id=$1 AND ($2=false OR (is_active=true AND operational_from<=current_date AND (operational_until IS NULL OR operational_until>=current_date))) ORDER BY name`,
    [organizationId, activeOnly],
  );
  return result.rows;
}

export async function getLocation(id, database = pool, organizationId = null) {
  const result = await database.query(
    `${locationSelect} WHERE l.id=$1 AND ($2::bigint IS NULL OR l.organization_id=$2)`,
    [id, organizationId],
  );
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
        `INSERT INTO locations (organization_id,parent_location_id,code,name,location_type,address,latitude,longitude,operational_from,operational_until,is_active)
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
          input.operationalFrom,
          input.operationalUntil,
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

export async function updateLocation(id, input, actor, requestId, organizationId = null) {
  try {
    return await withTransaction(async (client) => {
      const before = await client.query(
        "SELECT * FROM locations WHERE id=$1 AND ($2::bigint IS NULL OR organization_id=$2) FOR UPDATE",
        [id, organizationId],
      );
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
          latitude=$7,longitude=$8,operational_from=$9,operational_until=$10,is_active=$11
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
          input.operationalFrom,
          input.operationalUntil,
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

export async function deactivateLocation(id, actor, requestId, organizationId = null) {
  return withTransaction(async (client) => {
    const before = await client.query(
      "SELECT * FROM locations WHERE id=$1 AND ($2::bigint IS NULL OR organization_id=$2) FOR UPDATE",
      [id, organizationId],
    );
    if (!before.rows[0]) throw new ServiceError("NOT_FOUND", "Lokasi tidak ditemukan.", 404);
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
