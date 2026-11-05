import pool from "@/lib/dbConfig";
import { withTransaction } from "@/lib/dbTransaction";
import { writeAudit } from "@/lib/audit";
import { ServiceError } from "@/lib/api/routeHelpers";
import { ensureActorLocationAccess, getActorLocationScope } from "@/lib/auth/permissions";
import { employee, organization, requireScheduleAccess } from "@/lib/work-schedules/repository";

export const pointMenu = "attendance-point-access";
const managedCode = (id) => "LOCATION_" + id;
const authorize = (db, actor, org, manage) =>
  requireScheduleAccess(db, actor, org, pointMenu, manage);

export async function readPointConfiguration(actor, org, locationId) {
  await authorize(pool, actor, org, false);
  if (!locationId) return null;
  await ensureActorLocationAccess(actor, locationId);
  return (
    (
      await pool.query(
        `SELECT is_active AS enabled, radius_m AS "radiusMeters", max_accuracy_m AS "maxAccuracyMeters"
       FROM attendance_points WHERE organization_id=$1 AND location_id=$2 AND code=$3`,
        [org, locationId, managedCode(locationId)],
      )
    ).rows[0] ?? null
  );
}

export async function saveLocationPoint(db, actor, input, id, requestId) {
  const point = input.attendancePoint;
  await authorize(db, actor, input.organizationId, true);
  await ensureActorLocationAccess(actor, id, db);
  const previous = (
    await db.query(
      "SELECT * FROM attendance_points WHERE organization_id=$1 AND location_id=$2 AND code=$3 FOR UPDATE",
      [input.organizationId, id, managedCode(id)],
    )
  ).rows[0];
  if (!point.enabled && !previous) return;
  if (point.enabled && (!input.isActive || input.latitude == null || input.longitude == null))
    throw new ServiceError(
      "POINT_INCOMPLETE",
      "Aktifkan lokasi dan isi kedua koordinat titik absen.",
      422,
    );
  const result = point.enabled
    ? await db.query(
        `INSERT INTO attendance_points(organization_id,location_id,code,name,latitude,longitude,radius_m,max_accuracy_m,active_from,active_until)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT(organization_id,code) DO UPDATE SET name=excluded.name,latitude=excluded.latitude,
           longitude=excluded.longitude,radius_m=excluded.radius_m,max_accuracy_m=excluded.max_accuracy_m,
           active_from=excluded.active_from,active_until=excluded.active_until,is_active=true
         WHERE attendance_points.location_id=excluded.location_id RETURNING id`,
        [
          input.organizationId,
          id,
          managedCode(id),
          input.name,
          input.latitude,
          input.longitude,
          point.radiusMeters,
          point.maxAccuracyMeters,
          input.operationalFrom,
          input.operationalUntil ?? null,
        ],
      )
    : await db.query(
        "UPDATE attendance_points SET is_active=false WHERE organization_id=$1 AND id=$2 RETURNING id",
        [input.organizationId, previous.id],
      );
  if (!result.rowCount)
    throw new ServiceError("POINT_CONFLICT", "Identitas titik absensi sudah digunakan.", 409);
  if (point.enabled)
    await db.query(
      `WITH existing AS (
       UPDATE attendance_point_assignments SET effective_from=LEAST(effective_from,$4::date)
       WHERE organization_id=$1 AND attendance_point_id=$2 AND location_id=$3 AND revoked_at IS NULL
       RETURNING id
     ) INSERT INTO attendance_point_assignments(organization_id,attendance_point_id,location_id,effective_from,created_by_user_id)
     SELECT $1,$2,$3,$4,$5 WHERE NOT EXISTS (
       SELECT 1 FROM existing
     )`,
      [input.organizationId, result.rows[0].id, id, input.operationalFrom, actor.id],
    );
  await writeAudit(db, {
    organizationId: input.organizationId,
    actorUserId: actor.id,
    action: "attendance_point.configure",
    entityType: "attendance_point",
    entityId: result.rows[0].id,
    beforeData: previous,
    afterData: { ...point, latitude: input.latitude, longitude: input.longitude, locationId: id },
    requestId,
  });
}

export async function listPointAccess(actor, org, { page, pageSize, search, status }) {
  await authorize(pool, actor, org, false);
  const scope = await getActorLocationScope(actor);
  const result = await pool.query(
    `SELECT a.id::text, e.full_name, e.employee_no, p.name AS point_name,
            a.effective_from::text, a.effective_until::text, a.revoked_at,
            a.effective_until < (now() AT TIME ZONE o.timezone)::date AS expired,
            a.effective_from > (now() AT TIME ZONE o.timezone)::date AS upcoming,
            count(*) OVER()::int AS total
     FROM attendance_point_assignments a
     JOIN employees e ON e.organization_id=a.organization_id AND e.id=a.employee_id
     JOIN attendance_points p ON p.organization_id=a.organization_id AND p.id=a.attendance_point_id
     JOIN organizations o ON o.id=a.organization_id
     WHERE a.organization_id=$1 AND e.deleted_at IS NULL
       AND (e.full_name ILIKE $2 OR e.employee_no ILIKE $2 OR p.name ILIKE $2)
       AND ($6='all' OR ($6='active' AND a.revoked_at IS NULL AND (a.effective_until IS NULL OR a.effective_until >= (now() AT TIME ZONE o.timezone)::date))
            OR ($6='inactive' AND (a.revoked_at IS NOT NULL OR a.effective_until < (now() AT TIME ZONE o.timezone)::date)))
       AND ($5::bigint[] IS NULL OR (p.location_id=ANY($5) AND EXISTS(
         SELECT 1 FROM employee_assignments x WHERE x.organization_id=a.organization_id AND x.employee_id=e.id
           AND x.assignment_type='primary' AND x.location_id=ANY($5) AND x.effective_from<=current_date
           AND (x.effective_until IS NULL OR x.effective_until>=current_date))))
     ORDER BY a.id DESC LIMIT $3 OFFSET $4`,
    [org, "%" + search + "%", pageSize, (page - 1) * pageSize, scope, status],
  );
  return { data: result.rows.map(({ total, ...row }) => row), total: result.rows[0]?.total ?? 0 };
}

export async function accessOptions(actor, org, kind, search) {
  await authorize(pool, actor, org, false);
  const scope = await getActorLocationScope(actor);
  const { today } = await organization(pool, org);
  const query =
    kind === "points"
      ? `SELECT p.id::text AS value,p.name AS label FROM attendance_points p
         JOIN locations l ON l.organization_id=p.organization_id AND l.id=p.location_id
         WHERE p.organization_id=$1 AND p.is_active AND l.is_active AND p.name ILIKE $2
           AND ($3::bigint[] IS NULL OR l.id=ANY($3)) AND (p.active_until IS NULL OR p.active_until >= $4)
           AND (l.operational_until IS NULL OR l.operational_until >= $4)
         ORDER BY p.name,p.id LIMIT 50`
      : `SELECT e.id::text AS value,e.full_name || ' · ' || e.employee_no AS label FROM employees e
         WHERE e.organization_id=$1 AND e.deleted_at IS NULL AND e.employment_status IN ('active','probation')
           AND (e.full_name ILIKE $2 OR e.employee_no ILIKE $2)
           AND ($3::bigint[] IS NULL OR EXISTS(
             SELECT 1 FROM employee_assignments x WHERE x.organization_id=e.organization_id AND x.employee_id=e.id
               AND x.assignment_type='primary' AND x.location_id=ANY($3) AND x.effective_from<=current_date
               AND (x.effective_until IS NULL OR x.effective_until>=current_date)))
         ORDER BY e.full_name,e.id LIMIT 50`;
  const params = [org, "%" + search + "%", scope];
  if (kind === "points") params.push(today);
  return { options: (await pool.query(query, params)).rows, today };
}

export async function changePointAccess(actor, org, input, requestId) {
  return withTransaction(async (db) => {
    await authorize(db, actor, org, true);
    const { today } = await organization(db, org);
    const old = input.revokeId
      ? (
          await db.query(
            `SELECT a.*,p.location_id FROM attendance_point_assignments a JOIN attendance_points p
         ON p.organization_id=a.organization_id AND p.id=a.attendance_point_id
       WHERE a.organization_id=$1 AND a.id=$2 AND a.employee_id IS NOT NULL FOR UPDATE OF a`,
            [org, input.revokeId],
          )
        ).rows[0]
      : null;
    if (input.revokeId && !old)
      throw new ServiceError("NOT_FOUND", "Akses titik tidak ditemukan.", 404);
    const target = await employee(db, actor, org, old?.employee_id ?? input.employeeId, true);
    let ids;
    if (old) {
      await ensureActorLocationAccess(actor, old.location_id, db);
      if (old.revoked_at) return;
      await db.query(
        "UPDATE attendance_point_assignments SET revoked_at=now() WHERE organization_id=$1 AND id=$2",
        [org, old.id],
      );
      ids = [old.id];
    } else {
      if (
        !["active", "probation"].includes(target.employment_status) ||
        input.from < target.joined_date ||
        input.from < today
      )
        throw new ServiceError(
          "INVALID_PERIOD",
          "Pilih Pegawai aktif dan tanggal mulai yang berlaku.",
          422,
        );
      const points = (
        await db.query(
          `SELECT p.id::text,p.location_id FROM attendance_points p JOIN locations l
           ON l.organization_id=p.organization_id AND l.id=p.location_id
         WHERE p.organization_id=$1 AND p.id=ANY($2::bigint[]) AND p.is_active AND l.is_active
           AND p.active_from <= $3 AND (p.active_until IS NULL OR p.active_until >= $3)
           AND l.operational_from <= $3 AND (l.operational_until IS NULL OR l.operational_until >= $3)`,
          [org, input.pointIds, input.from],
        )
      ).rows;
      if (points.length !== input.pointIds.length)
        throw new ServiceError(
          "POINT_UNAVAILABLE",
          "Ada titik yang tidak aktif pada tanggal mulai.",
          422,
        );
      for (const point of points) await ensureActorLocationAccess(actor, point.location_id, db);
      const rows = await db.query(
        `INSERT INTO attendance_point_assignments(organization_id,attendance_point_id,employee_id,effective_from,effective_until,created_by_user_id)
         SELECT $1,p,$2,$3,$4,$5 FROM unnest($6::bigint[]) AS p
         WHERE NOT EXISTS (SELECT 1 FROM attendance_point_assignments a WHERE a.organization_id=$1
           AND a.attendance_point_id=p AND a.employee_id=$2 AND a.revoked_at IS NULL
           AND (a.effective_until IS NULL OR a.effective_until >= $3)
           AND ($4::date IS NULL OR a.effective_from <= $4))
         RETURNING id::text`,
        [org, input.employeeId, input.from, input.until, actor.id, input.pointIds],
      );
      if (rows.rowCount !== points.length)
        throw new ServiceError(
          "ACCESS_OVERLAP",
          "Pegawai sudah memiliki akses ke salah satu titik pada periode ini.",
          409,
        );
      ids = rows.rows.map((row) => row.id);
    }
    await writeAudit(db, {
      organizationId: org,
      actorUserId: actor.id,
      action: old ? "attendance_point_access.revoke" : "attendance_point_access.assign",
      entityType: "attendance_point_assignment",
      entityId: ids[0],
      afterData: { ...input, ids },
      requestId,
    });
  });
}
