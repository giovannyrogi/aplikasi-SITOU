/** Alias hanya berasal dari query internal, bukan input pengguna. */
export function incompleteEmployeeSql(alias) {
  return `(${alias}.national_id IS NULL OR ${alias}.profile_photo_file_id IS NULL
    OR NOT EXISTS (SELECT 1 FROM employee_contacts contact
      WHERE contact.organization_id=${alias}.organization_id AND contact.employee_id=${alias}.id)
    OR NOT EXISTS (SELECT 1 FROM employee_assignments assignment
      WHERE assignment.organization_id=${alias}.organization_id AND assignment.employee_id=${alias}.id
        AND assignment.assignment_type='primary' AND assignment.effective_from<=current_date
        AND (assignment.effective_until IS NULL OR assignment.effective_until>=current_date)))`;
}
