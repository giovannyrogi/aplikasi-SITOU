import AppIcon from "@/app/components/icons/AppIcon";
import { MENU_DEFINITIONS } from "@/lib/access/menuCatalog.mjs";
/** Ikon JSX hanya dibuat di UI; metadata navigasi/akses berasal dari katalog bersama. */
function renderMenu(menu) {
  return {
    ...menu,
    icon: <AppIcon icon={menu.icon} fontSize="20px" />,
    ...(menu.submenu ? { submenu: menu.submenu.map(renderMenu) } : {}),
  };
}
export default MENU_DEFINITIONS.map(renderMenu);
