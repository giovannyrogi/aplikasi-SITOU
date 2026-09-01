const SELF_PROFILE_LINK_ROLES = new Set(["hrd", "leader"]);

/** Hanya HRD dan Pimpinan yang dapat menautkan akun sendiri ke profil pegawai. */
export function canLinkOwnEmployeeProfile(roleCode) {
  return SELF_PROFILE_LINK_ROLES.has(roleCode);
}
