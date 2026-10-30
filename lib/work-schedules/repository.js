import { ServiceError } from "@/lib/api/routeHelpers";
import { readHrisState } from "@/lib/access/hrisRepository";
import { ensureActorEmployeeAccess } from "@/lib/auth/permissions";
import { requireAttendanceModule } from "@/lib/access/organizationModuleAccess";
/** Pemeriksaan terkini juga dipakai finalisasi onboarding, bukan hanya route. */
export async function requireScheduleAccess(db, actor, org, key, manage = false) {
  if (
    actor.role_code !== "superadmin" &&
    (actor.role_code !== "hrd" || String(actor.organization_id) !== String(org))
  )
    throw new ServiceError("FORBIDDEN", "Anda tidak memiliki akses.", 403);
  // Urutan organisasi yang sama dengan mutasi jadwal dan aktivasi fitur.
  if (manage) await db.query("SELECT id FROM organizations WHERE id=$1 FOR NO KEY UPDATE", [org]);
  await requireAttendanceModule(db, org);
  if (actor.role_code === "superadmin") return;
  const state = await readHrisState(org, actor.role_assignment_id, actor.role_code, db);
  const level = state.fullAdmin ? "manage" : state.grants.find((x) => x.key === key)?.level;
  if (!level || (manage && level !== "manage"))
    throw new ServiceError("FORBIDDEN", "Anda tidak memiliki akses.", 403);
}
/** Lock Pegawai mengunci namespace target sebelum periode/snapshot diubah. */
export async function employee(db, actor, org, id, lock = false) {
  const r = await db.query(
    `SELECT id::text,employee_no,full_name,employment_status,joined_date::text FROM employees WHERE organization_id=$1 AND id=$2 AND deleted_at IS NULL ${lock ? "FOR UPDATE" : ""}`,
    [org, id],
  );
  if (!r.rows[0]) throw new ServiceError("EMPLOYEE_NOT_FOUND", "Pegawai tidak ditemukan.", 404);
  await ensureActorEmployeeAccess(actor, id, org, db);
  return r.rows[0];
}
export async function organization(db, org, lock = false) {
  const r = await db.query(
    `SELECT timezone,(now() AT TIME ZONE timezone)::date::text AS today FROM organizations WHERE id=$1 AND is_active ${lock ? "FOR NO KEY UPDATE" : ""}`,
    [org],
  );
  if (!r.rows[0]) throw new ServiceError("ORGANIZATION_INACTIVE", "Organisasi tidak aktif.", 409);
  return r.rows[0];
}
/** Semua data jadwal terikat organisasi pada sumber query. */
export async function context(db, org) {
  const shifts = (
    await db.query(
      "SELECT id::text,name,is_active,version FROM work_shifts WHERE organization_id=$1",
      [org],
    )
  ).rows;
  const revisions = (
    await db.query(
      "SELECT id::text,shift_id::text,effective_from::text,effective_until::text,rules,reason FROM work_shift_revisions WHERE organization_id=$1 ORDER BY effective_from",
      [org],
    )
  ).rows;
  const patterns = (
    await db.query(
      "SELECT *,id::text,calendar_id::text FROM shift_patterns WHERE organization_id=$1",
      [org],
    )
  ).rows;
  const days = (
    await db.query(
      "SELECT shift_pattern_id::text,day_no,session_no,shift_id::text FROM shift_pattern_days WHERE organization_id=$1 ORDER BY day_no,session_no",
      [org],
    )
  ).rows;
  for (const p of patterns)
    p.days = Array.from({ length: p.cycle_days }, (_, i) => ({
      day: i + 1,
      shiftIds: days
        .filter((x) => x.shift_pattern_id === p.id && x.day_no === i + 1 && x.shift_id)
        .map((x) => x.shift_id),
    }));
  return { shifts, revisions, patterns };
}
export async function employeeRules(db, org, id) {
  const assignments = (
    await db.query(
      "SELECT *,id::text,shift_pattern_id::text,anchor_date::text,effective_from::text,effective_until::text FROM shift_assignments WHERE organization_id=$1 AND employee_id=$2 AND cancelled_at IS NULL ORDER BY shift_assignments.effective_from",
      [org, id],
    )
  ).rows;
  const exceptions = (
    await db.query(
      "SELECT x.*,x.id::text,x.work_date::text,ARRAY(SELECT s.shift_id::text FROM work_schedule_exception_sessions s WHERE s.organization_id=x.organization_id AND s.exception_id=x.id ORDER BY s.session_no) AS shift_ids FROM work_schedule_exceptions x WHERE x.organization_id=$1 AND x.employee_id=$2",
      [org, id],
    )
  ).rows;
  return { assignments, exceptions };
}
export async function protectedDay(db, org, id, date) {
  return Boolean(
    (
      await db.query(
        `SELECT 1 FROM employee_daily_schedules d WHERE d.organization_id=$1 AND d.employee_id=$2 AND d.work_date=$3 AND (
 EXISTS(SELECT 1 FROM attendance_events a WHERE a.organization_id=d.organization_id AND a.daily_schedule_id=d.id)
 OR EXISTS(SELECT 1 FROM attendance_daily_summaries s WHERE s.organization_id=d.organization_id AND s.employee_id=d.employee_id AND s.work_date=d.work_date)) LIMIT 1`,
        [org, id, date],
      )
    ).rows[0],
  );
}
