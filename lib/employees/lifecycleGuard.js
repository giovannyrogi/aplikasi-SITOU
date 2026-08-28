import { ServiceError } from "@/lib/api/routeHelpers";
import { isFinalEmploymentStatus } from "@/lib/employees/terminationPolicy.mjs";

/** Mengunci pegawai dan menolak perubahan operasional setelah hubungan kerjanya berakhir. */
export async function ensureEmployeeLifecycleEditable(database, employeeId, organizationId) {
  const result = await database.query(
    `SELECT id,employment_status FROM employees
     WHERE id=$1 AND organization_id=$2 AND deleted_at IS NULL FOR UPDATE`,
    [employeeId, organizationId],
  );
  const employee = result.rows[0];
  if (!employee) throw new ServiceError("NOT_FOUND", "Pegawai tidak ditemukan.", 404);
  if (isFinalEmploymentStatus(employee.employment_status))
    throw new ServiceError(
      "EMPLOYEE_FINAL_STATUS_LOCKED",
      "Hubungan kerja pegawai telah berakhir. Data operasional tidak dapat diubah melalui form biasa.",
      409,
    );
  return employee;
}
