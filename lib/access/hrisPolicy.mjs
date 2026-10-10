import { MENU_LEAVES } from "./menuCatalog.mjs";
/** Katalog tertutup menu HRIS. Fitur baru tidak otomatis membuka hak baru. */
export const HRIS_MENUS = MENU_LEAVES.filter(
  (menu) => menu.access.kind === "hris" || menu.value === "dashboard",
).map((menu) => ({
  key: menu.value,
  group: menu.group,
  label: menu.label,
  path: menu.path,
  canManage: menu.access.canManage,
  assignable: menu.access.assignable,
  description: menu.access.description,
}));
/** Kewenangan akun tidak mengikuti paket operasional Inventaris. */
export function accountCapabilities(user) {
  const state = user.access?.hris || user.hrisContext;
  const platform = user.role_code === "superadmin";
  const hrd = user.role_code === "hrd";
  const full = platform || (hrd && Boolean(state?.fullAdmin));
  const legacy = hrd && !state?.configured;
  return {
    canManageAccounts: full || legacy || (hrd && Boolean(state?.canManageEmployeeAccounts)),
    canDelegateNonHris: full || legacy || (hrd && Boolean(state?.canDelegateEmployeeFeatures)),
    canGrantHris: full,
    canManageAllAccountRoles: full,
  };
}
/** Membaca level menu dari snapshot UI; backend selalu mengambil konfigurasi terkini. */
export function hrisLevel(user, key) {
  const definition = HRIS_MENUS.find((menu) => menu.key === key);
  if (!definition) return null;
  if (user.role_code === "superadmin") return definition.canManage ? "manage" : "read";
  if (user.role_code === "leader") return "read";
  const state = user.access?.hris || user.hrisContext;
  if (user.role_code !== "hrd") return null;
  if (!state || !state.configured || state.fullAdmin)
    return definition.canManage ? "manage" : "read";
  return state.grants.find((g) => g.key === key)?.level || null;
}
/** Menentukan pemilik aksi agar tab detail tidak membuka akses submenu lain. */
export function hrisRouteOwner(path, method = "GET") {
  const read = ["GET", "HEAD", "OPTIONS"].includes(method);
  if (path === "/dashboard") return { key: "dashboard", level: "login" };
  if (!path.startsWith("/api/")) {
    if (
      path === "/profile" ||
      path.startsWith("/inventory/") ||
      path.startsWith("/master-data/inventory-") ||
      path === "/reports/inventory-distribution"
    )
      return null;
    if (path === "/master-data/leave-types") return { key: "leave-settings", level: "read" };
    if (
      ["/employee-assignments", "/employment-contracts", "/discipline"].some(
        (prefix) => path === prefix || path.startsWith(prefix + "/"),
      )
    )
      return { key: "employees", level: "read" };
    const menu = [...HRIS_MENUS]
      .sort((a, b) => b.path.length - a.path.length)
      .find((m) => path === m.path || path.startsWith(m.path + "/"));
    if (menu) return { key: menu.key, level: "read" };
    if (path.startsWith("/access/accounts")) return { key: "accounts", level: "read" };
    return { key: "unknown", level: "read" };
  }
  if (
    path.startsWith("/api/account/") ||
    path.startsWith("/api/auth/") ||
    path === "/api/access/me" ||
    path === "/api/access/modules" ||
    path === "/api/uploads/profile_self" ||
    path.startsWith("/api/inventory/")
  )
    return null;
  if (path === "/api/employees/export") return { key: "employees", level: "manage" };
  // Metadata lengkap hanya untuk Data Pegawai; file ID diperiksa lagi berdasarkan kategori.
  if (path === "/api/uploads") return { key: "employees", level: read ? "read" : "manage" };
  if (path.startsWith("/api/uploads/")) return null;
  if (path.startsWith("/api/access/accounts"))
    return { key: "accounts", level: read ? "read" : "manage" };
  if (path.startsWith("/api/dashboard/")) return { key: "dashboard", level: "login" };
  if (path.startsWith("/api/reports/")) {
    const key = path.includes("expiring-contracts")
      ? "expiring-contracts-report"
      : path.includes("retirements")
        ? "retirement-report"
        : path.includes("disciplinary-actions")
          ? "disciplinary-actions-report"
          : null;
    return { key: key || "unknown", level: "read" };
  }
  const masters = {
    locations: "master-locations",
    "organization-unit-types": "master-organization-unit-types",
    "organization-units": "master-organization-units",
    positions: "master-positions",
    "employment-types": "master-employment-types",
    "leave-types": "leave-settings",
  };
  const root = path.split("/")[2];
  if (masters[root])
    return {
      key: masters[root],
      level: read && path.endsWith("/options") ? "reference" : read ? "read" : "manage",
    };
  if (path.startsWith("/api/organization-settings/retirement"))
    return { key: "retirement-policy", level: read ? "read" : "manage" };
  if (path.startsWith("/api/discipline/action-types"))
    return { key: "disciplinary-action-settings", level: read ? "read" : "manage" };
  if (/^\/api\/employees\/\d+\/discipline-history$/.test(path) && read)
    return { key: "disciplinary-history", level: "read" };
  if (path.startsWith("/api/leave-requests") || /\/leave-(summary|balances)/.test(path))
    return { key: "leave-requests", level: read ? "read" : "manage" };
  if (path === "/api/employees/options" || path === "/api/employees/reference-options")
    return { key: "employees", level: "reference" };
  if (path.startsWith("/api/employees") || path.startsWith("/api/discipline"))
    return { key: "employees", level: read ? "read" : "manage" };
  return { key: "unknown", level: "read" };
}
/** Scope dan perhitungan bisnis tidak diubah; ini hanya pemeriksaan hak menu. */
export function canUseHrisRoute(user, path, method) {
  if (user.role_code !== "hrd" || !user.hrisContext?.configured) return true;
  const owner = hrisRouteOwner(path, method);
  if (!owner || owner.level === "login") return true;
  if (owner.key === "accounts") return accountCapabilities(user).canManageAccounts;
  if (owner.key === "disciplinary-history")
    return Boolean(hrisLevel(user, "employees") || hrisLevel(user, "disciplinary-actions-report"));
  if (owner.level === "reference")
    return (
      user.hrisContext.fullAdmin ||
      user.hrisContext.grants.some(
        (grant) => HRIS_MENUS.find((menu) => menu.key === grant.key)?.assignable,
      )
    );
  if (
    path.startsWith("/api/") &&
    owner.key === "leave-settings" &&
    owner.level === "read" &&
    hrisLevel(user, "leave-requests")
  )
    return true;
  const level = hrisLevel(user, owner.key);
  return owner.level === "manage" ? level === "manage" : Boolean(level);
}

/** Memisahkan file identitas dari lampiran izin dan foto referensi pegawai. */
export function canUseHrisFile(user, category, mutate = false) {
  if (user.role_code !== "hrd" || !user.hrisContext?.configured) return true;
  const key = category === "leave_attachment" ? "leave-requests" : "employees";
  if (!mutate && ["profile_photo", "employee_photo"].includes(category))
    return Boolean(
      hrisLevel(user, "leave-requests") ||
      hrisLevel(user, "employees") ||
      hrisLevel(user, "expiring-contracts-report") ||
      hrisLevel(user, "retirement-report") ||
      hrisLevel(user, "disciplinary-actions-report"),
    );
  if (!mutate && category === "discipline_letter" && hrisLevel(user, "disciplinary-actions-report"))
    return true;
  return mutate ? hrisLevel(user, key) === "manage" : Boolean(hrisLevel(user, key));
}
/** Metadata halaman untuk komponen reusable, bukan sumber izin backend. */
export function hrisPageMenu(path) {
  if (path === "/master-data/leave-types")
    return HRIS_MENUS.find((menu) => menu.key === "leave-settings");
  return [...HRIS_MENUS]
    .sort((a, b) => b.path.length - a.path.length)
    .find((menu) => path === menu.path || path.startsWith(menu.path + "/"));
}
