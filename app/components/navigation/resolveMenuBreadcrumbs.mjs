/** Menormalkan path agar pencocokan route tidak terpengaruh trailing slash. */
function normalizePath(path = "") {
  if (!path || path === "/") return path || "/";
  return path.replace(/\/+$/, "");
}

/** Memilih rantai menu dengan path paling spesifik untuk route aktif atau route turunannya. */
export function resolveMenuBreadcrumbs(menuList, pathname) {
  const currentPath = normalizePath(pathname);
  let bestMatch = null;

  const visit = (items, ancestors = []) => {
    items.forEach((item) => {
      const chain = [...ancestors, item];
      const itemPath = normalizePath(item.path);

      if (
        itemPath &&
        (currentPath === itemPath || currentPath.startsWith(`${itemPath}/`)) &&
        (!bestMatch || itemPath.length > bestMatch.path.length)
      ) {
        bestMatch = { path: itemPath, chain };
      }

      if (item.submenu?.length) visit(item.submenu, chain);
    });
  };

  visit(menuList || []);
  return bestMatch?.chain || [];
}
