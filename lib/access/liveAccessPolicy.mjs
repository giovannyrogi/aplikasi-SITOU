import { MENU_LEAVES } from "./menuCatalog.mjs";
import {
  HRIS_MENUS,
  accountCapabilities,
  canUseHrisRoute,
  hrisLevel,
  hrisPageMenu,
  hrisRouteOwner,
} from "./hrisPolicy.mjs";

const INVENTORY_PAGE_WRITES = Object.freeze({
  "inventory-items": [
    "inventory.catalog.create",
    "inventory.catalog.update",
    "inventory.item_warehouses.update",
  ],
  "inventory-categories": ["inventory.catalog.create", "inventory.catalog.update"],
  "inventory-units": ["inventory.catalog.create", "inventory.catalog.update"],
  "inventory-warehouses": ["inventory.warehouses.create", "inventory.warehouses.update"],
});

/** Metadata izin UI; keputusan akhir setiap aksi tetap dibuat oleh API. */
export function pageAccessState(roleCode, snapshot, pathname) {
  if (roleCode === "superadmin") return { canRead: true, writeKeys: [] };
  const menu = MENU_LEAVES.find(
    (entry) => entry.path && (pathname === entry.path || pathname.startsWith(entry.path + "/")),
  );
  if (menu?.permission?.startsWith("inventory.")) {
    const canRead = Boolean(snapshot?.permissions?.includes(menu.permission));
    const available = new Set(snapshot?.writePermissions || []);
    return {
      canRead,
      writeKeys: canRead
        ? (INVENTORY_PAGE_WRITES[menu.value] || []).filter((key) => available.has(key))
        : [],
    };
  }
  if (roleCode !== "hrd") return { canRead: true, writeKeys: [] };
  const actor = { role_code: roleCode, hrisContext: snapshot?.hris };
  const canRead = canUseHrisRoute(actor, pathname, "GET");
  if (!canRead) return { canRead: false, writeKeys: [] };
  if (pathname === "/access/accounts")
    return {
      canRead,
      writeKeys: accountCapabilities(actor).canManageAccounts ? ["accounts.manage"] : [],
    };
  const owner =
    hrisPageMenu(pathname) ||
    HRIS_MENUS.find((entry) => entry.key === hrisRouteOwner(pathname, "GET")?.key);
  return {
    canRead,
    writeKeys:
      owner?.canManage && hrisLevel(actor, owner.key) === "manage" ? [owner.key + ".manage"] : [],
  };
}

/** Pencabutan hak baca lebih kuat daripada pencabutan hak ubah. */
export function accessChangeImpact(roleCode, pathname, before, after) {
  const previous = pageAccessState(roleCode, before, pathname);
  const current = pageAccessState(roleCode, after, pathname);
  if (previous.canRead && !current.canRead) return "redirect";
  if (current.canRead && previous.writeKeys.some((key) => !current.writeKeys.includes(key)))
    return current.writeKeys.length ? "write-reduced" : "read-only";
  return null;
}
