import pool from "@/lib/dbConfig";
import { ServiceError } from "@/lib/api/routeHelpers";
import * as repo from "./repository";
import { mutation, saveMasterInTransaction, shiftAt, HASH, checkVersion } from "./service";

async function members(db, org, group) {
  return (
    await db.query(
      "SELECT *,id::text,pattern_id::text,shift_id::text FROM work_schedule_group_items WHERE organization_id=$1 AND group_id=$2 ORDER BY position,work_schedule_group_items.id",
      [org, group],
    )
  ).rows;
}
async function hasHistory(db, org, items) {
  const patterns = items.map((item) => item.pattern_id),
    shifts = items.map((item) => item.shift_id);
  return Boolean(
    (
      await db.query(
        `SELECT 1 FROM shift_assignments WHERE organization_id=$1 AND shift_pattern_id=ANY($2::bigint[])
    UNION ALL SELECT 1 FROM work_schedule_sessions WHERE organization_id=$1 AND shift_id=ANY($3::bigint[])
    UNION ALL SELECT 1 FROM work_schedule_exception_sessions WHERE organization_id=$1 AND shift_id=ANY($3::bigint[]) LIMIT 1`,
        [org, patterns, shifts],
      )
    ).rows.length,
  );
}
export async function listShiftGroups(
  actor,
  org,
  { q = "", page = 1, pageSize = 20, status = "all" } = {},
) {
  await repo.requireScheduleAccess(pool, actor, org, "work-shifts");
  const info = await repo.organization(pool, org);
  const active = status === "active" ? true : status === "inactive" ? false : null;
  const args = [org, `%${q}%`, active];
  const total = (
    await pool.query(
      "SELECT count(*)::int AS n FROM work_schedule_groups WHERE organization_id=$1 AND name ILIKE $2 AND ($3::boolean IS NULL OR is_active=$3)",
      args,
    )
  ).rows[0].n;
  const rows = (
    await pool.query(
      "SELECT *,id::text FROM work_schedule_groups WHERE organization_id=$1 AND name ILIKE $2 AND ($3::boolean IS NULL OR is_active=$3) ORDER BY lower(name),work_schedule_groups.id LIMIT $4 OFFSET $5",
      [...args, pageSize, (page - 1) * pageSize],
    )
  ).rows;
  const ctx = await repo.context(pool, org);
  for (const group of rows) {
    const all = await members(pool, org, group.id);
    group.used = await hasHistory(pool, org, all);
    group.shifts = all
      .filter((item) => item.is_current)
      .map((item) => ({
        name: item.name,
        patternId: item.pattern_id,
        rules: shiftAt(ctx, item.shift_id, info.today).rules,
      }));
    group.calendar_name = group.calendar_id
      ? (
          await pool.query("SELECT name FROM work_calendars WHERE organization_id=$1 AND id=$2", [
            org,
            group.calendar_id,
          ])
        ).rows[0]?.name
      : null;
    group.kind = "shift";
  }
  return { data: rows, total, page, pageSize };
}
/** Setiap shift mempunyai pola sendiri agar penetapan memilih satu shift, bukan seluruh pilihan. */
export async function saveShiftGroup(actor, input, requestId) {
  return mutation(actor, input, "work-shifts", "shift-group.save", requestId, async (db, org) => {
    let old,
      items = [],
      used = false;
    if (input.id) {
      old = (
        await db.query(
          "SELECT *,id::text FROM work_schedule_groups WHERE organization_id=$1 AND id=$2 FOR UPDATE",
          [input.organizationId, input.id],
        )
      ).rows[0];
      if (!old) throw new ServiceError("NOT_FOUND", "Jadwal shift tidak ditemukan.", 404);
      checkVersion(old, input.version);
      items = await members(db, input.organizationId, input.id);
      used = await hasHistory(db, input.organizationId, items);
    }
    const ctx = await repo.context(db, input.organizationId);
    const current = items.filter((item) => item.is_current);
    let structureSame = false;
    if (old) {
      const prior = {
        days: [...old.working_days].sort(),
        calendar: String(old.calendar_id || ""),
        policy: old.holiday_policy,
        shifts: current.map((item) => ({
          name: item.name,
          rules: shiftAt(ctx, item.shift_id, org.today).rules,
        })),
      };
      const next = {
        days: [...input.workingDays].sort(),
        calendar: String(input.calendarId || ""),
        policy: input.holidayPolicy,
        shifts: input.shifts,
      };
      structureSame = HASH(prior) === HASH(next);
      if (used && !structureSame)
        throw new ServiceError(
          "SCHEDULE_USED",
          "Jadwal sudah digunakan. Buat salinan jadwal untuk mengubah hari atau shift.",
          409,
          { shifts: "Buat salinan jadwal untuk mengubah pengaturannya." },
        );
    }
    // Metadata tetap dapat disimpan ketika kalender lama sudah dinonaktifkan.
    if (
      input.calendarId &&
      !(old && structureSame) &&
      !(
        await db.query(
          "SELECT 1 FROM work_calendars WHERE organization_id=$1 AND id=$2 AND is_active",
          [input.organizationId, input.calendarId],
        )
      ).rows.length
    )
      throw new ServiceError(
        "CALENDAR_INVALID",
        "Kalender libur tidak tersedia. Pilih kalender yang aktif pada organisasi ini.",
        422,
        { calendarId: "Pilih kalender libur yang tersedia." },
      );
    let id = input.id;
    if (old)
      await db.query(
        "UPDATE work_schedule_groups SET name=$3,working_days=$4,calendar_id=$5,holiday_policy=$6,is_active=$7,version=version+1,updated_at=now() WHERE organization_id=$1 AND id=$2",
        [
          input.organizationId,
          id,
          input.name,
          [...input.workingDays].sort(),
          input.calendarId,
          input.holidayPolicy,
          input.isActive,
        ],
      );
    else
      id = (
        await db.query(
          "INSERT INTO work_schedule_groups(organization_id,name,working_days,calendar_id,holiday_policy,is_active) VALUES($1,$2,$3,$4,$5,$6) RETURNING id::text",
          [
            input.organizationId,
            input.name,
            [...input.workingDays].sort(),
            input.calendarId,
            input.holidayPolicy,
            input.isActive,
          ],
        )
      ).rows[0].id;
    const options = { groupWrite: true };
    if (used || structureSame) {
      for (const item of current) {
        const name = `${input.name} — ${item.name}`;
        await db.query(
          "UPDATE shift_patterns SET name=$3,is_active=$4,version=version+1,updated_at=now() WHERE organization_id=$1 AND id=$2",
          [input.organizationId, item.pattern_id, name, input.isActive],
        );
        await db.query(
          "UPDATE work_shifts SET name=$3,is_active=$4,version=version+1,updated_at=now() WHERE organization_id=$1 AND id=$2",
          [input.organizationId, item.shift_id, name, input.isActive],
        );
      }
      return { id, patternIds: current.map((item) => item.pattern_id) };
    }
    // Pilihan yang belum dipakai diarsipkan utuh. Request penetapan dengan pilihan lama harus memuat ulang.
    for (const item of current) {
      await db.query(
        "UPDATE shift_patterns SET name=left(name,65)||' — arsip '||id::text,is_active=false,version=version+1,updated_at=now() WHERE organization_id=$1 AND id=$2",
        [input.organizationId, item.pattern_id],
      );
      await db.query(
        "UPDATE work_shifts SET name=left(name,65)||' — arsip '||id::text,is_active=false,version=version+1,updated_at=now() WHERE organization_id=$1 AND id=$2",
        [input.organizationId, item.shift_id],
      );
    }
    await db.query(
      "UPDATE work_schedule_group_items SET is_current=false WHERE organization_id=$1 AND group_id=$2 AND is_current",
      [input.organizationId, id],
    );
    const patternIds = [];
    for (const [index, shift] of input.shifts.entries()) {
      const name = `${input.name} — ${shift.name}`;
      const savedShift = await saveMasterInTransaction(
        db,
        actor,
        { organizationId: input.organizationId, name, isActive: true, rules: shift.rules },
        "shifts",
        org,
        options,
      );
      const pattern = await saveMasterInTransaction(
        db,
        actor,
        {
          organizationId: input.organizationId,
          name,
          isActive: input.isActive,
          patternType: "weekly",
          cycleDays: 7,
          calendarId: input.calendarId,
          holidayPolicy: input.holidayPolicy,
          days: Array.from({ length: 7 }, (_, day) => ({
            day: day + 1,
            shiftIds: input.workingDays.includes(day + 1) ? [savedShift.id] : [],
          })),
        },
        "patterns",
        org,
        options,
      );
      // Pola dibangun dari shift aktif, kemudian status privatnya mengikuti kelompok secara atomik.
      if (!input.isActive)
        await db.query(
          "UPDATE work_shifts SET is_active=false,version=version+1,updated_at=now() WHERE organization_id=$1 AND id=$2",
          [input.organizationId, savedShift.id],
        );
      await db.query(
        "INSERT INTO work_schedule_group_items(organization_id,group_id,pattern_id,shift_id,name,position) VALUES($1,$2,$3,$4,$5,$6)",
        [input.organizationId, id, pattern.id, savedShift.id, shift.name, index + 1],
      );
      patternIds.push(pattern.id);
    }
    return { id, patternIds, replacedUnusedPatternIds: current.map((item) => item.pattern_id) };
  });
}
