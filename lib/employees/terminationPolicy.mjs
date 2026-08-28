export const FINAL_EMPLOYMENT_STATUSES = Object.freeze(["terminated", "retired", "deceased"]);

/** Menentukan apakah status pegawai sudah menutup lifecycle hubungan kerja. */
export function isFinalEmploymentStatus(status) {
  return FINAL_EMPLOYMENT_STATUSES.includes(status);
}

/** Memeriksa aturan tanggal dan lifecycle sebelum hubungan kerja diakhiri. */
export function validateEmployeeTermination({ currentStatus, joinedDate, terminationDate, today }) {
  if (isFinalEmploymentStatus(currentStatus)) {
    return {
      code: "EMPLOYEE_ALREADY_TERMINATED",
      message: "Hubungan kerja pegawai ini sudah berakhir dan tidak dapat diproses ulang.",
    };
  }
  if (terminationDate < joinedDate) {
    return {
      code: "TERMINATION_BEFORE_JOINED_DATE",
      message: "Tanggal berakhir tidak boleh sebelum tanggal bergabung pegawai.",
    };
  }
  if (terminationDate > today) {
    return {
      code: "TERMINATION_DATE_IN_FUTURE",
      message: "Tanggal berakhir tidak boleh melewati hari ini.",
    };
  }
  return null;
}
