import { accountCapabilities } from "@/lib/access/hrisPolicy.mjs";
export const getMenusByRole = (menus, roleCode, access = null) => {
  const visible = (menu) => {
    if (menu.permission)
      return roleCode === "superadmin" || access?.permissions?.includes(menu.permission);
    if (roleCode === "hrd" && access?.hris?.configured) {
      if (menu.value === "dashboard") return true;
      if (menu.value === "organization-accounts")
        return accountCapabilities({ role_code: roleCode, access }).canManageAccounts;
      return access.hris.grants.some((grant) => grant.key === menu.value);
    }
    return menu.roles?.includes(roleCode);
  };
  return menus
    .map((menu) => {
      if (!menu.submenu) return visible(menu) ? menu : null;
      const submenu = menu.submenu.filter(visible);
      return submenu.length ? { ...menu, submenu } : null;
    })
    .filter(Boolean);
};
