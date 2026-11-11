import { ServiceError } from "@/lib/api/routeHelpers";
import { withTransaction } from "@/lib/dbTransaction";
import { organization, requireScheduleAccess } from "./repository";
import { mutation } from "./service";

const operationFor = (kind) => `${kind}.delete`;
const usedMessage =
  "Jadwal ini pernah digunakan. Nonaktifkan jadwal agar tidak dapat dipilih untuk penetapan baru.";
const unverifiedMessage =
  "Riwayat penggunaan jadwal ini belum dapat dipastikan. Nonaktifkan jadwal jika sudah tidak diperlukan.";

function requireScheduleDeletionRole(actor) {
  if (actor.role_code !== "superadmin")
    throw new ServiceError(
      "FORBIDDEN",
      "Hanya Admin SITOU yang dapat menghapus jadwal kerja.",
      403,
    );
}

async function inspect(db, org, kind, id) {
  const group = kind === "shift-group";
  const table = group ? "work_schedule_groups" : "shift_patterns";
  const row = (
    await db.query(
      `SELECT s.id::text, s.name, s.version, o.name AS organization
       FROM ${table} s JOIN organizations o ON o.id=s.organization_id
       WHERE s.organization_id=$1 AND s.id=$2`,
      [org, id],
    )
  ).rows[0];
  if (!row)
    throw new ServiceError("ALREADY_DELETED", "Jadwal sudah dihapus atau tidak ditemukan.", 404);

  const members = (
    await db.query(
      `SELECT pattern_id::text, shift_id::text FROM work_schedule_group_items
       WHERE organization_id=$1 AND ${group ? "group_id" : "pattern_id"}=$2`,
      [org, id],
    )
  ).rows;
  if (!group && members.length)
    throw new ServiceError(
      "SCHEDULE_USED",
      "Pilihan shift dikelola melalui kelompok jadwalnya.",
      409,
    );

  const patternIds = group ? members.map((member) => member.pattern_id) : [id];
  const { used } = (
    await db.query(
      `SELECT EXISTS (
        SELECT 1 FROM shift_assignments WHERE organization_id=$1 AND shift_pattern_id=ANY($2::bigint[])
        UNION ALL
        SELECT 1 FROM work_schedule_definition_revisions WHERE organization_id=$1 AND pattern_id=ANY($2::bigint[])
        UNION ALL
        SELECT 1 FROM audit_logs WHERE organization_id=$1 AND entity_type='work_schedule'
          AND action IN ('work_schedule.assign', 'work_schedule.assign.request', 'work_schedule.exception.bulk')
          AND after_data->>'patternId'=ANY($2::text[])
      ) AS used`,
      [org, patternIds],
    )
  ).rows[0];
  if (used)
    return { ...row, eligible: false, code: "SCHEDULE_USED", message: usedMessage, patternIds };

  // Older changes selected raw shift IDs. Copies may share those IDs, so they do not prove use
  // of one particular pattern. An exact source in the audit of the current change takes precedence.
  const { ambiguous } = (
    await db.query(
      `WITH hours AS (
         SELECT unnest($3::bigint[]) AS id
         UNION
         SELECT shift_id FROM shift_pattern_days WHERE organization_id=$1
           AND shift_pattern_id=ANY($2::bigint[]) AND shift_id IS NOT NULL
       )
       SELECT EXISTS (
         SELECT 1 FROM audit_logs a
         WHERE a.organization_id=$1 AND a.entity_type='work_schedule'
           AND a.action IN ('work_schedule.exception','work_schedule.exception.bulk')
           AND a.after_data->>'patternId' IS NULL
           AND EXISTS (
             SELECT 1 FROM hours h WHERE (a.after_data->'shiftIds') ? h.id::text
           )
         UNION ALL
         SELECT 1 FROM work_schedule_exceptions e WHERE e.organization_id=$1
           AND (
             EXISTS (SELECT 1 FROM hours h WHERE h.id=ANY(e.shift_ids))
             OR EXISTS (
               SELECT 1 FROM work_schedule_exception_sessions s JOIN hours h ON h.id=s.shift_id
               WHERE s.organization_id=e.organization_id AND s.exception_id=e.id
             )
           )
           AND NOT EXISTS (
             SELECT 1 FROM audit_logs a WHERE a.organization_id=e.organization_id
               AND a.entity_type='work_schedule' AND a.action='work_schedule.exception.bulk'
               AND a.occurred_at=e.updated_at AND a.after_data->>'patternId' IS NOT NULL
               AND (a.after_data->'employeeIds') ? e.employee_id::text
               AND e.work_date BETWEEN (a.after_data->>'from')::date AND (a.after_data->>'until')::date
           )
         UNION ALL
         SELECT 1 FROM employee_daily_schedules d WHERE d.organization_id=$1
           AND d.source_assignment_id IS NULL AND d.source_exception_id IS NULL
           AND (d.shift_id IN (SELECT id FROM hours) OR EXISTS (
             SELECT 1 FROM work_schedule_sessions s WHERE s.organization_id=d.organization_id
               AND s.daily_schedule_id=d.id AND s.shift_id IN (SELECT id FROM hours)
           ))
       ) AS ambiguous`,
      [org, patternIds, members.map((member) => member.shift_id)],
    )
  ).rows[0];
  return {
    ...row,
    eligible: !ambiguous,
    code: ambiguous ? "HISTORY_UNVERIFIED" : null,
    message: ambiguous ? unverifiedMessage : null,
    patternIds,
    groupHours: members.map((member) => member.shift_id),
  };
}

export async function readScheduleDeletion(actor, org, kind, id, requestKey) {
  requireScheduleDeletionRole(actor);
  return withTransaction(async (db) => {
    await requireScheduleAccess(db, actor, org, "work-shifts", true);
    await organization(db, org, true);
    if (requestKey) {
      const receipt = (
        await db.query(
          `SELECT result FROM work_schedule_requests
           WHERE organization_id=$1 AND actor_user_id=$2 AND operation=$3 AND request_key=$4`,
          [org, actor.id, operationFor(kind), requestKey],
        )
      ).rows[0];
      return receipt?.result.id === id ? receipt.result : { state: "not_recorded" };
    }
    const {
      patternIds: _patternIds,
      groupHours: _groupHours,
      ...preview
    } = await inspect(db, org, kind, id);
    return preview;
  });
}

export async function deleteSchedule(actor, kind, input, requestId) {
  requireScheduleDeletionRole(actor);
  const org = input.organizationId;
  return mutation(actor, input, "work-shifts", operationFor(kind), requestId, async (db) => {
    const row = await inspect(db, org, kind, input.id);
    if (row.version !== input.version)
      throw new ServiceError(
        "VERSION_CONFLICT",
        "Jadwal telah berubah. Muat ulang daftar, lalu periksa kembali.",
        409,
      );
    if (!row.eligible) throw new ServiceError(row.code, row.message, 409);

    if (kind === "shift-group")
      await db.query(
        "DELETE FROM work_schedule_group_items WHERE organization_id=$1 AND group_id=$2",
        [org, input.id],
      );
    await db.query(
      "DELETE FROM shift_pattern_days WHERE organization_id=$1 AND shift_pattern_id=ANY($2::bigint[])",
      [org, row.patternIds],
    );
    await db.query("DELETE FROM shift_patterns WHERE organization_id=$1 AND id=ANY($2::bigint[])", [
      org,
      row.patternIds,
    ]);
    if (kind === "shift-group") {
      await db.query("DELETE FROM work_schedule_groups WHERE organization_id=$1 AND id=$2", [
        org,
        input.id,
      ]);
      // Keep immutable hour revisions while freeing the names of unused private group shifts.
      await db.query(
        `UPDATE work_shifts w SET
           name=left(w.name,65)||' — arsip '||w.id::text,
           is_active=false, version=w.version+1, updated_at=now()
         WHERE w.organization_id=$1 AND w.id=ANY($2::bigint[])
           AND w.name NOT LIKE '% — arsip '||w.id::text
           AND NOT EXISTS (
             SELECT 1 FROM shift_pattern_days d WHERE d.organization_id=w.organization_id AND d.shift_id=w.id
           )
           AND NOT EXISTS (
             SELECT 1 FROM work_schedule_definition_revisions r
             CROSS JOIN LATERAL jsonb_array_elements(r.days) AS day
             WHERE r.organization_id=w.organization_id AND (day->'shiftIds') ? w.id::text
           )
           AND NOT EXISTS (
             SELECT 1 FROM work_schedule_sessions s WHERE s.organization_id=w.organization_id AND s.shift_id=w.id
           )
           AND NOT EXISTS (
             SELECT 1 FROM employee_daily_schedules s WHERE s.organization_id=w.organization_id AND s.shift_id=w.id
           )
           AND NOT EXISTS (
             SELECT 1 FROM work_schedule_exception_sessions s WHERE s.organization_id=w.organization_id AND s.shift_id=w.id
           )
           AND NOT EXISTS (
             SELECT 1 FROM work_schedule_exceptions e WHERE e.organization_id=w.organization_id AND w.id=ANY(e.shift_ids)
           )`,
        [org, row.groupHours],
      );
    }

    return {
      state: "deleted",
      id: row.id,
      name: row.name,
      message: "Jadwal kerja berhasil dihapus.",
    };
  });
}
