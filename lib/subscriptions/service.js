import pool from "@/lib/dbConfig";
import { writeAudit } from "@/lib/audit";
import { ServiceError } from "@/lib/api/routeHelpers";
import { getEffectiveSubscriptionStatus } from "./status.mjs";

export const effectiveSubscriptionStatusSql = (subscription = "os", organization = "o") => `CASE
  WHEN ${subscription}.status IN ('suspended','cancelled') THEN ${subscription}.status
  WHEN (now() AT TIME ZONE ${organization}.timezone)::date < ${subscription}.starts_on THEN 'scheduled'
  WHEN (now() AT TIME ZONE ${organization}.timezone)::date <= ${subscription}.ends_on THEN 'active'
  WHEN ${subscription}.grace_ends_on IS NOT NULL AND (now() AT TIME ZONE ${organization}.timezone)::date <= ${subscription}.grace_ends_on THEN 'grace'
  ELSE 'expired'
END`;

const serialize = (row) =>
  row
    ? {
        ...row,
        id: String(row.id),
        organization_id: String(row.organization_id),
        created_by_user_id: row.created_by_user_id ? String(row.created_by_user_id) : null,
      }
    : null;

const mapConstraint = (error) => {
  if (error?.code === "23P01")
    throw new ServiceError(
      "SUBSCRIPTION_OVERLAP",
      "Periode langganan bertumpang tindih dengan periode lain.",
      409,
    );
  throw error;
};

export async function insertSubscription(client, { organizationId, input, actor, requestId }) {
  const organization = await client.query(
    "SELECT id,timezone FROM organizations WHERE id=$1 FOR UPDATE",
    [organizationId],
  );
  if (!organization.rows[0])
    throw new ServiceError("NOT_FOUND", "Organisasi tidak ditemukan.", 404);
  const duplicate = await client.query(
    "SELECT id FROM organization_subscriptions WHERE organization_id=$1 AND request_id=$2::uuid",
    [organizationId, requestId],
  );
  if (duplicate.rows[0]) return duplicate.rows[0].id;
  try {
    const result = await client.query(
      `INSERT INTO organization_subscriptions
      (organization_id,starts_on,ends_on,grace_ends_on,status,notes,created_by_user_id,request_id)
      VALUES ($1,$2,$3,$4,CASE
        WHEN (now() AT TIME ZONE $5)::date<$2::date THEN 'scheduled'
        WHEN (now() AT TIME ZONE $5)::date<=$3::date THEN 'active'
        WHEN $4::date IS NOT NULL AND (now() AT TIME ZONE $5)::date<=$4::date THEN 'grace'
        ELSE 'expired' END,$6,$7,$8::uuid)
      ON CONFLICT (organization_id,request_id) DO UPDATE SET request_id=EXCLUDED.request_id
      RETURNING id`,
      [
        organizationId,
        input.startsOn,
        input.endsOn,
        input.graceEndsOn,
        organization.rows[0].timezone,
        input.notes,
        actor.id,
        requestId,
      ],
    );
    return result.rows[0].id;
  } catch (error) {
    mapConstraint(error);
  }
}

export async function listOrganizationSubscriptions(organizationId, database = pool) {
  const exists = await database.query("SELECT id FROM organizations WHERE id=$1", [organizationId]);
  if (!exists.rows[0]) throw new ServiceError("NOT_FOUND", "Organisasi tidak ditemukan.", 404);
  const result = await database.query(
    `SELECT os.id,os.organization_id,os.starts_on::text,os.ends_on::text,
    os.grace_ends_on::text,os.status AS stored_status,${effectiveSubscriptionStatusSql()} AS status,
    os.notes,os.created_by_user_id,u.full_name AS created_by_name,os.created_at,os.updated_at
    FROM organization_subscriptions os JOIN organizations o ON o.id=os.organization_id
    LEFT JOIN users u ON u.id=os.created_by_user_id WHERE os.organization_id=$1
    ORDER BY os.starts_on DESC,os.id DESC`,
    [organizationId],
  );
  return result.rows.map(serialize);
}

export async function createOrganizationSubscription(organizationId, input, actor, requestId) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const id = await insertSubscription(client, { organizationId, input, actor, requestId });
    const result = await client.query(
      "SELECT * FROM organization_subscriptions WHERE organization_id=$1 AND id=$2",
      [organizationId, id],
    );
    await writeAudit(client, {
      organizationId,
      actorUserId: actor.id,
      action: "organization_subscription.create",
      entityType: "organization_subscription",
      entityId: id,
      afterData: result.rows[0],
      requestId,
    });
    await client.query("COMMIT");
    return serialize(result.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function changeOrganizationSubscription(
  organizationId,
  subscriptionId,
  input,
  actor,
  requestId,
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const organization = await client.query(
      "SELECT id,timezone FROM organizations WHERE id=$1 FOR UPDATE",
      [organizationId],
    );
    if (!organization.rows[0])
      throw new ServiceError("NOT_FOUND", "Organisasi tidak ditemukan.", 404);
    const before = await client.query(
      "SELECT * FROM organization_subscriptions WHERE organization_id=$1 AND id=$2 FOR UPDATE",
      [organizationId, subscriptionId],
    );
    if (!before.rows[0])
      throw new ServiceError("NOT_FOUND", "Periode langganan tidak ditemukan.", 404);
    const period = before.rows[0];
    let status =
      input.action === "suspend" ? "suspended" : input.action === "cancel" ? "cancelled" : null;
    if (!status) {
      const todayResult = await client.query(
        "SELECT (now() AT TIME ZONE $1)::date::text AS today",
        [organization.rows[0].timezone],
      );
      const today = todayResult.rows[0].today;
      status = getEffectiveSubscriptionStatus({
        storedStatus: "scheduled",
        startsOn: String(period.starts_on).slice(0, 10),
        endsOn: String(period.ends_on).slice(0, 10),
        graceEndsOn: period.grace_ends_on ? String(period.grace_ends_on).slice(0, 10) : null,
        today,
      });
    }
    let updated;
    try {
      updated = await client.query(
        `UPDATE organization_subscriptions SET status=$3,
        notes=concat_ws(E'\n',notes,$4::text) WHERE organization_id=$1 AND id=$2
        AND date_trunc('milliseconds',updated_at)=date_trunc('milliseconds',$5::timestamptz) RETURNING *`,
        [organizationId, subscriptionId, status, `${input.action}: ${input.reason}`, input.version],
      );
    } catch (error) {
      mapConstraint(error);
    }
    if (!updated.rowCount)
      throw new ServiceError(
        "VERSION_CONFLICT",
        "Data telah berubah. Muat ulang sebelum melanjutkan.",
        409,
      );
    await writeAudit(client, {
      organizationId,
      actorUserId: actor.id,
      action: `organization_subscription.${input.action}`,
      entityType: "organization_subscription",
      entityId: subscriptionId,
      beforeData: period,
      afterData: { status, reason: input.reason },
      requestId,
    });
    await client.query("COMMIT");
    return serialize(updated.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function reconcileOrganizationSubscriptions(database = pool) {
  const result = await database.query(`UPDATE organization_subscriptions os SET status=CASE
    WHEN (now() AT TIME ZONE o.timezone)::date<os.starts_on THEN 'scheduled'
    WHEN (now() AT TIME ZONE o.timezone)::date<=os.ends_on THEN 'active'
    WHEN os.grace_ends_on IS NOT NULL AND (now() AT TIME ZONE o.timezone)::date<=os.grace_ends_on THEN 'grace'
    ELSE 'expired' END FROM organizations o WHERE o.id=os.organization_id
    AND os.status NOT IN ('suspended','cancelled') AND os.status IS DISTINCT FROM CASE
      WHEN (now() AT TIME ZONE o.timezone)::date<os.starts_on THEN 'scheduled'
      WHEN (now() AT TIME ZONE o.timezone)::date<=os.ends_on THEN 'active'
      WHEN os.grace_ends_on IS NOT NULL AND (now() AT TIME ZONE o.timezone)::date<=os.grace_ends_on THEN 'grace'
      ELSE 'expired' END RETURNING os.id`);
  return result.rowCount;
}
