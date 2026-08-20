export const getMenusByRole = (menus, roleCode) => {
  return menus
    .map((menu) => {
      // cek role menu utama
      const hasMenuAccess = menu?.roles?.includes(roleCode);

      // filter submenu
      const filteredSubmenu = menu?.submenu
        ? menu.submenu.filter((sub) => sub?.roles.includes(roleCode))
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
