export const LEAVE_CATEGORY = {
  leave: ["Cuti", "success"],
  permission: ["Izin", "info"],
  sick: ["Sakit", "warning"],
  official_duty: ["Dinas", "info"],
  other: ["Lainnya", "neutral"],
};
export const LEAVE_STATUS = {
  draft: ["Draft", "neutral"],
  submitted: ["Menunggu", "warning"],
  approved: ["Disetujui", "success"],
  rejected: ["Ditolak", "danger"],
  cancelled: ["Dibatalkan", "neutral"],
};
export const LEAVE_UNIT = { day: "hari", hour: "jam" };
export const formatLeaveUnits = (value) =>
  new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(Number(value || 0));
export const LEAVE_SOURCE = {
  hrd_entry: "Dicatat HRD",
  employee_web: "Web Pegawai",
  employee_mobile: "Mobile Pegawai",
  import: "Import",
  api: "API",
};
export const formatLeaveDate = (value) =>
  value
    ? new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(
        new Date(`${String(value).slice(0, 10)}T00:00:00`),
      )
    : "-";
