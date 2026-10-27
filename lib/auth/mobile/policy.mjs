/** Kebijakan mobile terpisah; hasilnya tidak memperluas izin administrasi web. */
export function mobileAccessFailure(user) {
  if (!user) return { code: "UNAUTHENTICATED", message: "Sesi berakhir. Silakan masuk kembali." };
  if (user.organization_id && !user.organization_is_active)
    return { code: "ORGANIZATION_INACTIVE", message: "Organisasi dinonaktifkan." };
  if (user.organization_id) {
    const statuses = {
      scheduled: ["ORGANIZATION_NOT_STARTED", "Masa akses organisasi belum dimulai."],
      suspended: ["SUBSCRIPTION_SUSPENDED", "Masa akses organisasi ditangguhkan."],
      cancelled: ["SUBSCRIPTION_CANCELLED", "Masa akses organisasi dibatalkan."],
      expired: ["ORGANIZATION_EXPIRED", "Masa akses organisasi berakhir."],
    };
    const status = user.organization_subscription_status;
    if (statuses[status]) return { code: statuses[status][0], message: statuses[status][1] };
    if (!["active", "grace"].includes(status))
      return { code: "SUBSCRIPTION_UNAVAILABLE", message: "Masa akses organisasi belum tersedia." };
  }
  if (!user.employee_id || !user.organization_id)
    return { code: "EMPLOYEE_NOT_LINKED", message: "Akun belum terhubung ke profil Pegawai." };
  if (user.employee_deleted_at)
    return { code: "EMPLOYEE_PROFILE_UNAVAILABLE", message: "Profil Pegawai tidak tersedia." };
  const finalStatuses = {
    retired: ["EMPLOYEE_RETIRED", "Tidak dapat masuk. Status Pegawai sudah pensiun."],
    terminated: ["EMPLOYEE_TERMINATED", "Tidak dapat masuk. Hubungan kerja sudah berakhir."],
    deceased: ["EMPLOYEE_DECEASED", "Tidak dapat masuk. Status Pegawai tercatat meninggal."],
    draft: ["EMPLOYEE_DRAFT", "Profil Pegawai belum aktif."],
  };
  if (finalStatuses[user.employment_status]) {
    const [code, message] = finalStatuses[user.employment_status];
    return { code, message };
  }
  if (!user.is_active) return { code: "ACCOUNT_INACTIVE", message: "Akun dinonaktifkan." };
  if (!["employee", "hrd", "leader"].includes(user.role_code) || !user.role_assignment_id)
    return { code: "ROLE_INACTIVE", message: "Hak akses akun tidak aktif." };
  if (!["active", "probation", "suspended"].includes(user.employment_status))
    return { code: "EMPLOYEE_STATUS_INACTIVE", message: "Status Pegawai tidak aktif." };
  return null;
}

/** Hanya kirim identitas minimum; tidak ada hash, kontak atau hak admin tersirat. */
export function mobileUserPayload(user) {
  return {
    id: String(user.id),
    username: user.username,
    organizationId: String(user.organization_id),
    employeeId: String(user.employee_id),
    role: user.role_code,
    employmentStatus: user.employment_status,
    accessMode: user.employment_status === "suspended" ? "read_only" : "self_service",
  };
}
