/** Pesan konflik identitas tidak menyertakan nomor atau identitas pegawai lain. */
export function employeeIdentityConflict({ employeeNo = false, nationalId = false } = {}) {
  const fieldErrors = {};
  if (employeeNo)
    fieldErrors.employeeNo = "NIP sudah terdaftar pada organisasi ini. Gunakan NIP lain.";
  if (nationalId)
    fieldErrors.nationalId =
      "NIK KTP sudah terdaftar pada organisasi ini. Periksa kembali NIK KTP.";
  if (!Object.keys(fieldErrors).length) return null;
  return {
    code: "EMPLOYEE_DUPLICATE",
    message: Object.values(fieldErrors).join(" "),
    status: 409,
    fieldErrors,
  };
}

/** Nama constraint menjadi sumber pasti saat dua request lolos pemeriksaan bersamaan. */
export function employeeIdentityConstraintConflict(error) {
  if (error?.code !== "23505") return null;
  return employeeIdentityConflict({
    employeeNo: ["uq_employees_org_number", "uq_employees_org_number_normalized"].includes(
      error.constraint,
    ),
    nationalId: error.constraint === "uq_employees_org_nik",
  });
}
