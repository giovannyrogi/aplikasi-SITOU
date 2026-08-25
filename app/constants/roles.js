export const ROLES = {
  SUPERADMIN: "superadmin",
  HRD: "hrd",
  LEADER: "leader",
  EMPLOYEE: "employee",
};

export const ROLE_LABELS = {
  [ROLES.SUPERADMIN]: "Superadmin",
  [ROLES.HRD]: "HRD",
  [ROLES.LEADER]: "Pimpinan",
  [ROLES.EMPLOYEE]: "Pegawai",
};

const ROLE_ALIAS_MAP = {
  admin: ROLES.SUPERADMIN,
  direksi: ROLES.LEADER,
  leader: ROLES.LEADER,
  pimpinan: ROLES.LEADER,
  employee: ROLES.EMPLOYEE,
  karyawan: ROLES.EMPLOYEE,
};

/**
 * Role disimpan sebagai kode stabil agar menu, API, dan database menggunakan
 * kontrak yang sama tanpa bergantung pada ID numerik.
 */
export const normalizeRoleCode = (role) => {
  if (role === null || role === undefined) return null;

  const normalized = String(role).trim().toLowerCase();
  return ROLE_ALIAS_MAP[normalized] || normalized;
};

export const ALL_ROLE_CODES = Object.values(ROLES);
