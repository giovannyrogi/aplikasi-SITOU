export const getMenusByRole = (menus, roleCode, access = null) => {
  return menus
    .map((menu) => {
      // cek role menu utama
      const hasMenuAccess = menu.permission
        ? roleCode === "superadmin" || access?.permissions?.includes(menu.permission)
        : menu?.roles?.includes(roleCode);

      // filter submenu
      const filteredSubmenu = menu?.submenu
        ? menu.submenu.filter((sub) =>
            sub.permission
              ? roleCode === "superadmin" || access?.permissions?.includes(sub.permission)
              : sub?.roles.includes(roleCode),
          )
        : [];

      // jika punya submenu
      if (menu.submenu) {
        // tampilkan parent hanya jika ada submenu yg boleh
        if (filteredSubmenu.length === 0) return null;

        return {
          ...menu,
          submenu: filteredSubmenu,
        };
      }

      // menu tanpa submenu
      if (!hasMenuAccess) return null;

      return menu;
    })
    .filter(Boolean);
};
