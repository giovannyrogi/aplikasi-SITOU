/** Keputusan perubahan admin penuh tidak bergantung pada jumlah HRD aktif. */
export function resolveHrisAdminTransition({ primary, isHrisAdmin, roleCode, isActive }) {
  return {
    revoke: Boolean(primary && (isHrisAdmin === false || roleCode !== "hrd" || !isActive)),
    promote: isHrisAdmin === true && roleCode === "hrd" && isActive,
  };
}
