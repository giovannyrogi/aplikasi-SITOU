/** Pilihan filter bersama untuk direktori dan keterangan ekspor. */
export const EMPLOYEE_SANCTION_OPTIONS = Object.freeze([
  { value: "all", label: "Tanpa filter sanksi" },
  { value: "with_history", label: "Pernah mendapat sanksi" },
  { value: "with_sanction", label: "Memiliki sanksi aktif" },
  { value: "without_sanction", label: "Tidak memiliki sanksi aktif" },
]);
export const EMPLOYEE_SANCTION_VALUES = EMPLOYEE_SANCTION_OPTIONS.map(({ value }) => value);

/** Tanggal berlaku mengikuti kalender organisasi, termasuk tindakan dalam banding. */
export const EMPLOYEE_ACTIVE_SANCTION_SQL = `action.status IN ('active','appealed')
  AND action.effective_from<=(now() AT TIME ZONE organization.timezone)::date
  AND (action.effective_until IS NULL
    OR action.effective_until>=(now() AT TIME ZONE organization.timezone)::date)`;

/** EXISTS menjaga satu baris per pegawai walaupun memiliki beberapa sanksi. */
export function employeeSanctionFilterSql() {
  const official = `SELECT 1 FROM disciplinary_actions action
    WHERE action.organization_id=employee.organization_id AND action.employee_id=employee.id
      AND action.status<>'draft' AND ($12::bigint IS NULL OR action.action_type_id=$12)`;
  const active = `${official} AND (${EMPLOYEE_ACTIVE_SANCTION_SQL})`;
  return `(($8='all' AND ($12::bigint IS NULL OR EXISTS (${official})))
    OR ($8='with_history' AND EXISTS (${official}))
    OR ($8='with_sanction' AND EXISTS (${active}))
    OR ($8='without_sanction' AND NOT EXISTS (${active})))`;
}
