import { accountCapabilities } from "@/lib/access/hrisPolicy.mjs";
import { DASHBOARD_DESTINATIONS, dashboardViews } from "@/lib/dashboard/navigation.mjs";
import AppIcon from "@/app/components/icons/AppIcon";
export const getMenusByRole = (menus, roleCode, access = null) => {
  const visible = (menu) => {
    if (menu.permission)
      return roleCode === "superadmin" || access?.permissions?.includes(menu.permission);
    if (roleCode === "hrd") {
      if (menu.value === "dashboard") return true;
      if (!access?.hris) return false;
      if (menu.value === "organization-accounts")
        return accountCapabilities({ role_code: roleCode, access }).canManageAccounts;
      return access.hris.grants.some((grant) => grant.key === menu.value);
    }
    return menu.roles?.includes(roleCode);
  };
  return menus
    .map((menu) => {
      if (menu.value === "dashboard") {
        if (!visible(menu)) return null;
        const views = dashboardViews(roleCode, access);
        if (views.length > 1) return {
          ...menu,
          path: undefined,
          submenu: views.map((view) => ({
            ...DASHBOARD_DESTINATIONS[view],
            value: `dashboard-${view}`,
            icon: <AppIcon icon={DASHBOARD_DESTINATIONS[view].icon} fontSize="18px" />,
            showIcon: true,
          })),
        };
        return { ...menu, path: views.length ? DASHBOARD_DESTINATIONS[views[0]].path : "/dashboard" };
      }
      if (!menu.submenu) return visible(menu) ? menu : null;
      const submenu = menu.submenu.filter(visible);
      return submenu.length ? { ...menu, submenu } : null;
    })
    .filter(Boolean);
};
