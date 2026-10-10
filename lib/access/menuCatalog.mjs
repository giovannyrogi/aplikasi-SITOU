import { HRIS_MENU_DESCRIPTIONS } from "./accessDescriptions.mjs";
const DASHBOARD_ROLES = ["superadmin", "hrd", "leader"];
const MENU_CATALOG = [
  {
    label: "Dashboard",
    value: "dashboard",
    path: "/dashboard",
    icon: "navigation:dashboard",
    roles: [...DASHBOARD_ROLES, "employee"],
  },
  {
    label: "Data Master",
    value: "master-data",
    icon: "navigation:master-data",
    roles: ["superadmin", "hrd"],
    submenu: [
      {
        label: "Organisasi",
        value: "master-organizations",
        path: "/master-data/organizations",
        icon: "navigation:organization",
        showIcon: true,
        roles: ["superadmin"],
      },
      {
        label: "Lokasi",
        value: "master-locations",
        path: "/master-data/locations",
        icon: "navigation:location",
        showIcon: true,
        roles: ["superadmin", "hrd"],
      },
      {
        label: "Jenis Unit Organisasi",
        value: "master-organization-unit-types",
        path: "/master-data/organization-unit-types",
        icon: "navigation:organization-unit-type",
        showIcon: true,
        roles: ["superadmin", "hrd"],
      },
      {
        label: "Divisi & Unit",
        value: "master-organization-units",
        path: "/master-data/organization-units",
        icon: "navigation:organization-unit",
        showIcon: true,
        roles: ["superadmin", "hrd"],
      },
      {
        label: "Jabatan",
        value: "master-positions",
        path: "/master-data/positions",
        icon: "navigation:position",
        showIcon: true,
        roles: ["superadmin", "hrd"],
      },
      {
        label: "Jenis Kepegawaian",
        value: "master-employment-types",
        path: "/master-data/employment-types",
        icon: "navigation:employment-type",
        showIcon: true,
        roles: ["superadmin", "hrd"],
      },
      {
        label: "Barang Persediaan",
        value: "inventory-items",
        path: "/master-data/inventory-items",
        permission: "inventory.master.read",
        icon: "navigation:inventory-item",
        showIcon: true,
      },
      {
        label: "Kategori Barang",
        value: "inventory-categories",
        path: "/master-data/inventory-categories",
        permission: "inventory.master.read",
        icon: "navigation:inventory-category",
        showIcon: true,
      },
      {
        label: "Satuan Barang",
        value: "inventory-units",
        path: "/master-data/inventory-units",
        permission: "inventory.master.read",
        icon: "navigation:inventory-unit",
        showIcon: true,
      },
      {
        label: "Gudang",
        value: "inventory-warehouses",
        path: "/master-data/inventory-warehouses",
        permission: "inventory.master.read",
        icon: "navigation:inventory-warehouse",
        showIcon: true,
      },
    ],
  },
  {
    label: "Inventaris",
    value: "inventory",
    icon: "navigation:inventory",
    submenu: [
      {
        label: "Stok Barang",
        value: "inventory-stock",
        path: "/inventory/stock",
        permission: "inventory.stock.read",
        icon: "navigation:inventory-stock",
        showIcon: true,
      },
      {
        label: "Transaksi Barang",
        value: "inventory-transactions",
        path: "/inventory/transactions",
        permission: "inventory.transactions.read",
        icon: "navigation:inventory-transactions",
        showIcon: true,
      },
    ],
  },
  {
    label: "Kepegawaian",
    value: "employees-module",
    icon: "navigation:employees",
    roles: ["superadmin", "hrd", "leader"],
    submenu: [
      {
        label: "Data Pegawai",
        value: "employees",
        path: "/employees",
        icon: "navigation:employee-data",
        showIcon: true,
        roles: ["superadmin", "hrd", "leader"],
      },
      {
        label: "Cuti & Izin",
        value: "leave-requests",
        path: "/leave-requests",
        icon: "navigation:leave",
        showIcon: true,
        roles: ["superadmin", "hrd", "leader"],
      },
    ],
  },
  {
    label: "Laporan",
    value: "reports",
    icon: "navigation:reports",
    roles: DASHBOARD_ROLES,
    submenu: [
      {
        label: "Kontrak Akan Berakhir",
        value: "expiring-contracts-report",
        path: "/reports/expiring-contracts",
        icon: "navigation:expiring-contract",
        showIcon: true,
        roles: DASHBOARD_ROLES,
      },
      {
        label: "Proyeksi Pensiun",
        value: "retirement-report",
        path: "/reports/retirements",
        icon: "navigation:retirement-projection",
        showIcon: true,
        roles: DASHBOARD_ROLES,
      },
      {
        label: "Sanksi Pegawai",
        value: "disciplinary-actions-report",
        path: "/reports/disciplinary-actions",
        icon: "navigation:disciplinary-report",
        showIcon: true,
        roles: DASHBOARD_ROLES,
      },
      {
        label: "Distribusi Barang",
        value: "inventory-reports",
        path: "/reports/inventory-distribution",
        permission: "inventory.reports.read",
        icon: "navigation:inventory-reports",
        showIcon: true,
      },
    ],
  },
  {
    label: "Akun & Akses",
    value: "access-module",
    icon: "navigation:access",
    roles: ["superadmin", "hrd"],
    submenu: [
      {
        label: "Akun Organisasi",
        value: "organization-accounts",
        path: "/access/accounts",
        icon: "navigation:organization-account",
        showIcon: true,
        roles: ["superadmin", "hrd"],
      },
    ],
  },
  {
    label: "Pengaturan Organisasi",
    value: "organization-settings",
    icon: "navigation:organization-settings",
    roles: DASHBOARD_ROLES,
    submenu: [
      {
        label: "Aturan Cuti & Izin",
        value: "leave-settings",
        path: "/organization-settings/leave-types",
        icon: "navigation:leave-settings",
        showIcon: true,
        roles: ["superadmin", "hrd"],
      },
      {
        label: "Pengaturan Sanksi",
        value: "disciplinary-action-settings",
        path: "/organization-settings/disciplinary-actions",
        icon: "navigation:disciplinary-settings",
        showIcon: true,
        roles: ["superadmin", "hrd"],
      },
      {
        label: "Kebijakan Pensiun",
        value: "retirement-policy",
        path: "/organization-settings/retirement",
        icon: "navigation:retirement-policy",
        showIcon: true,
        roles: DASHBOARD_ROLES,
      },
    ],
  },
  {
    label: "Pemeliharaan Sistem",
    value: "system-maintenance",
    icon: "navigation:system-maintenance",
    roles: ["superadmin"],
    submenu: [
      {
        label: "Penyimpanan File",
        value: "storage-maintenance",
        path: "/system/storage-maintenance",
        icon: "navigation:storage-maintenance",
        showIcon: true,
        roles: ["superadmin"],
      },
      {
        label: "Backup Database",
        value: "system-backup",
        path: "/system/backups",
        icon: "solar:database-bold-duotone",
        showIcon: true,
        roles: ["superadmin"],
      },
    ],
  },
];

const editable = new Set([
  "master-locations",
  "master-organization-unit-types",
  "master-organization-units",
  "master-positions",
  "master-employment-types",
  "employees",
  "leave-requests",
  "leave-settings",
  "disciplinary-action-settings",
  "retirement-policy",
]);
const readOnly = new Set([
  "expiring-contracts-report",
  "retirement-report",
  "disciplinary-actions-report",
]);
/** Menyatukan definisi navigasi dan akses; menu baru wajib mempunyai metadata eksplisit. */
function defineMenu(menu, group = menu.label) {
  if (menu.submenu)
    return { ...menu, submenu: menu.submenu.map((child) => defineMenu(child, menu.label)) };
  let access;
  if (menu.value === "dashboard")
    access = {
      kind: "base",
      assignable: false,
      canManage: false,
      scope: "authenticated",
      delegation: "none",
      description: "Halaman awal. Konten mengikuti hak akses akun.",
    };
  else if (HRIS_MENU_DESCRIPTIONS[menu.value])
    access = {
      kind: "hris",
      assignable: true,
      canManage: editable.has(menu.value) ? true : readOnly.has(menu.value) ? false : undefined,
      scope: "organization-locations",
      delegation: "hris-admin",
      description: HRIS_MENU_DESCRIPTIONS[menu.value],
    };
  else if (menu.permission?.startsWith("inventory."))
    access = {
      kind: "inventory",
      assignable: true,
      canManage: !["inventory-reports"].includes(menu.value),
      scope: "grant-warehouse-or-organization",
      delegation: "non-hris",
      description: "Akses Inventaris sesuai izin dan cakupan fitur.",
    };
  else if (menu.value === "organization-accounts")
    access = {
      kind: "capability",
      assignable: true,
      canManage: true,
      scope: "organization-locations",
      delegation: "hris-admin",
      description: "Mengelola akun Pegawai dan, jika diizinkan, membagikan fitur selain HRIS.",
    };
  else if (["master-organizations", "storage-maintenance", "system-backup"].includes(menu.value))
    access = {
      kind: "platform",
      assignable: false,
      canManage: true,
      scope: "platform-explicit",
      delegation: "superadmin",
      description: "Administrasi platform khusus Superadmin.",
    };
  return { ...menu, group, access };
}
export const MENU_DEFINITIONS = MENU_CATALOG.map((menu) => defineMenu(menu));
export const MENU_LEAVES = MENU_DEFINITIONS.flatMap((menu) => menu.submenu || [menu]);
/** Guard registrasi: tidak boleh ada menu tanpa kontrak izin atau uraian. */
export function validateMenuCatalog() {
  for (const menu of MENU_LEAVES)
    if (
      !menu.access?.description ||
      !menu.access.scope ||
      !menu.access.delegation ||
      typeof menu.access.canManage !== "boolean"
    )
      throw new Error(`Definisi akses menu ${menu.value} belum lengkap.`);
  return true;
}
validateMenuCatalog();
