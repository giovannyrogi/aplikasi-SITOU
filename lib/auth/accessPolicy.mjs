const EMPLOYEE_ALLOWED_STATUSES = new Set(["active", "probation", "leave"]);

/** Menghasilkan alasan penolakan login pegawai berdasarkan profil dan penempatan aktifnya. */
export function getEmployeeAccessFailure(user) {
  if (user.role_code !== "employee") return null;

  if (!user.employee_id || user.employee_deleted_at) {
    return {
      code: "EMPLOYEE_PROFILE_INACTIVE",
      message:
        "Profil pegawai Anda tidak tersedia atau telah dinonaktifkan. Hubungi Admin organisasi Anda.",
    };
  }

  if (!EMPLOYEE_ALLOWED_STATUSES.has(user.employment_status)) {
    const statusMessage =
      user.employment_status === "draft"
        ? "Profil pegawai Anda belum diaktifkan."
        : "Status kepegawaian Anda sedang tidak aktif.";
    return {
      code: "EMPLOYEE_STATUS_INACTIVE",
      message: `${statusMessage} Hubungi Admin organisasi Anda.`,
    };
  }

  if (!user.employee_assignment_id) {
    return {
      code: "EMPLOYEE_ASSIGNMENT_INACTIVE",
      message:
        "Penempatan utama Anda belum tersedia atau sudah tidak berlaku. Hubungi Admin organisasi Anda.",
    };
  }

  if (!user.employee_location_is_active) {
    return {
      code: "EMPLOYEE_LOCATION_INACTIVE",
      message: "Lokasi penempatan Anda telah dinonaktifkan. Hubungi Admin organisasi Anda.",
    };
  }

  if (!user.employee_location_is_operational) {
    return {
      code: "EMPLOYEE_LOCATION_NOT_OPERATIONAL",
      message:
        "Lokasi penempatan Anda belum atau tidak lagi beroperasi. Hubungi Admin organisasi Anda.",
    };
  }

  if (!user.employee_unit_is_active) {
    return {
      code: "EMPLOYEE_UNIT_INACTIVE",
      message:
        "Divisi atau unit penempatan Anda telah dinonaktifkan. Hubungi Admin organisasi Anda.",
    };
  }

  return null;
}

/** Menentukan pihak yang perlu dihubungi ketika akun pengguna dinonaktifkan. */
export function getInactiveAccountMessage(user) {
  return user.role_scope === "platform"
    ? "Akun Anda telah dinonaktifkan. Hubungi pengelola sistem SITOU."
    : "Akun Anda telah dinonaktifkan. Hubungi Admin organisasi Anda.";
}
