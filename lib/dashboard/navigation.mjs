export const DASHBOARD_DESTINATIONS = Object.freeze({
  staff: { label: "Ringkasan Kepegawaian", path: "/dashboard/staff", icon: "navigation:dashboard-staff" },
  personal: { label: "Ringkasan Pribadi", path: "/dashboard/personal", icon: "navigation:dashboard-personal" },
  inventory: { label: "Inventaris", path: "/dashboard/inventory", icon: "navigation:dashboard-inventory" },
});

export function dashboardViews(roleCode, access) {
  const views = [];
  if (access?.dashboardSections?.length) views.push("staff");
  if (access?.personalVisible && ["employee", "hrd", "leader"].includes(roleCode))
    views.push("personal");
  if (access?.inventoryVisible) views.push("inventory");
  return views;
}

export function defaultDashboardView(roleCode, access) {
  const views = dashboardViews(roleCode, access);
  if (roleCode === "employee" && views.includes("personal")) return "personal";
  return views[0] || null;
}
