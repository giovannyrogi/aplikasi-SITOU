export const EMPLOYEE_STATUS_PRESENTATION = Object.freeze({
  active: ["Aktif", "success"],
  probation: ["Masa percobaan", "info"],
  leave: ["Cuti", "warning"],
  suspended: ["Ditangguhkan", "danger"],
  draft: ["Draft", "neutral"],
  terminated: ["Diberhentikan", "danger"],
  retired: ["Pensiun", "neutral"],
  deceased: ["Meninggal dunia", "neutral"],
});

export const TERMINATION_STATUS_OPTIONS = Object.freeze([
  { value: "terminated", label: "Diberhentikan" },
  { value: "retired", label: "Pensiun" },
  { value: "deceased", label: "Meninggal dunia" },
]);

const FINAL_EMPLOYMENT_STATUSES = new Set(TERMINATION_STATUS_OPTIONS.map((item) => item.value));

/** Menentukan apakah lifecycle pegawai sudah berakhir dan tidak boleh dimutasi melalui form biasa. */
export function isFinalEmploymentStatus(status) {
  return FINAL_EMPLOYMENT_STATUSES.has(status);
}

/** Mengambil label dan tone status dengan fallback yang tetap terbaca. */
export function getEmployeeStatusPresentation(status) {
  return EMPLOYEE_STATUS_PRESENTATION[status] || [status || "Belum ditentukan", "neutral"];
}

/** Mengambil label resmi jenis akhir hubungan kerja. */
export function getTerminationStatusLabel(status) {
  return TERMINATION_STATUS_OPTIONS.find((item) => item.value === status)?.label || status;
}
