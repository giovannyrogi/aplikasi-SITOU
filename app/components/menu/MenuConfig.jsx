import AppIcon from "@/app/components/icons/AppIcon";
import { ROLES } from "./ConstantRoles";

const DASHBOARD_ROLES = [ROLES.SUPERADMIN, ROLES.HRD, ROLES.LEADER];

const MENU_CONFIG = [
  {
    label: "Dashboard",
    value: "dashboard",
    path: "/dashboard",
    icon: <AppIcon icon="navigation:dashboard" fontSize="20px" />,
    roles: DASHBOARD_ROLES,
  },
  {
    label: "Data Master",
    value: "master-data",
    icon: <AppIcon icon="navigation:master-data" fontSize="20px" />,
    roles: [ROLES.SUPERADMIN, ROLES.HRD],
    submenu: [
      {
        label: "Organisasi",
        value: "master-organizations",
        path: "/master-data/organizations",
        icon: <AppIcon icon="navigation:organization" fontSize="20px" />,
        showIcon: true,
        roles: [ROLES.SUPERADMIN],
      },
      {
        label: "Lokasi",
        value: "master-locations",
        path: "/master-data/locations",
        icon: <AppIcon icon="navigation:location" fontSize="20px" />,
        showIcon: true,
        roles: [ROLES.SUPERADMIN, ROLES.HRD],
      },
      {
        label: "Jenis Unit Organisasi",
        value: "master-organization-unit-types",
        path: "/master-data/organization-unit-types",
        icon: <AppIcon icon="navigation:organization-unit-type" fontSize="20px" />,
        showIcon: true,
        roles: [ROLES.SUPERADMIN, ROLES.HRD],
      },
      {
        label: "Divisi & Unit",
        value: "master-organization-units",
        path: "/master-data/organization-units",
        icon: <AppIcon icon="navigation:organization-unit" fontSize="20px" />,
        showIcon: true,
        roles: [ROLES.SUPERADMIN, ROLES.HRD],
      },
      {
        label: "Jabatan",
        value: "master-positions",
        path: "/master-data/positions",
        icon: <AppIcon icon="navigation:position" fontSize="20px" />,
        showIcon: true,
        roles: [ROLES.SUPERADMIN, ROLES.HRD],
      },
      {
        label: "Jenis Kepegawaian",
        value: "master-employment-types",
        path: "/master-data/employment-types",
        icon: <AppIcon icon="navigation:employment-type" fontSize="20px" />,
        showIcon: true,
        roles: [ROLES.SUPERADMIN, ROLES.HRD],
      },
    ],
  },
  {
    label: "Kepegawaian",
    value: "employees-module",
    icon: <AppIcon icon="navigation:employees" fontSize="20px" />,
    roles: [ROLES.SUPERADMIN, ROLES.HRD, ROLES.LEADER],
    submenu: [
      {
        label: "Data Pegawai",
        value: "employees",
        path: "/employees",
        icon: <AppIcon icon="navigation:employee-data" fontSize="20px" />,
        showIcon: true,
        roles: [ROLES.SUPERADMIN, ROLES.HRD, ROLES.LEADER],
      },
      {
        label: "Cuti & Izin",
        value: "leave-requests",
        path: "/leave-requests",
        icon: <AppIcon icon="navigation:leave" fontSize="20px" />,
        showIcon: true,
        roles: [ROLES.SUPERADMIN, ROLES.HRD, ROLES.LEADER],
      },
    ],
  },
  {
    label: "Laporan",
    value: "reports",
    icon: <AppIcon icon="navigation:reports" fontSize="20px" />,
    roles: DASHBOARD_ROLES,
    submenu: [
      {
        label: "Kontrak Akan Berakhir",
        value: "expiring-contracts-report",
        path: "/reports/expiring-contracts",
        icon: <AppIcon icon="navigation:expiring-contract" fontSize="20px" />,
        showIcon: true,
        roles: DASHBOARD_ROLES,
      },
      {
        label: "Proyeksi Pensiun",
        value: "retirement-report",
        path: "/reports/retirements",
        icon: <AppIcon icon="navigation:retirement-projection" fontSize="20px" />,
        showIcon: true,
        roles: DASHBOARD_ROLES,
      },
      {
        label: "Sanksi Pegawai",
        value: "disciplinary-actions-report",
        path: "/reports/disciplinary-actions",
        icon: <AppIcon icon="navigation:disciplinary-report" fontSize="20px" />,
        showIcon: true,
        roles: DASHBOARD_ROLES,
      },
    ],
  },
  {
    label: "Akun & Akses",
    value: "access-module",
    icon: <AppIcon icon="navigation:access" fontSize="20px" />,
    roles: [ROLES.SUPERADMIN, ROLES.HRD],
    submenu: [
      {
        label: "Akun Organisasi",
        value: "organization-accounts",
        path: "/access/accounts",
        icon: <AppIcon icon="navigation:organization-account" fontSize="20px" />,
        showIcon: true,
        roles: [ROLES.SUPERADMIN, ROLES.HRD],
      },
    ],
  },
  {
    label: "Pengaturan Organisasi",
    value: "organization-settings",
    icon: <AppIcon icon="navigation:organization-settings" fontSize="20px" />,
    roles: DASHBOARD_ROLES,
    submenu: [
      {
        label: "Aturan Cuti & Izin",
        value: "leave-settings",
        path: "/organization-settings/leave-types",
        icon: <AppIcon icon="navigation:leave-settings" fontSize="20px" />,
        showIcon: true,
        roles: [ROLES.SUPERADMIN, ROLES.HRD],
      },
      {
        label: "Pengaturan Sanksi",
        value: "disciplinary-action-settings",
        path: "/organization-settings/disciplinary-actions",
        icon: <AppIcon icon="navigation:disciplinary-settings" fontSize="20px" />,
        showIcon: true,
        roles: [ROLES.SUPERADMIN, ROLES.HRD],
      },
      {
        label: "Kebijakan Pensiun",
        value: "retirement-policy",
        path: "/organization-settings/retirement",
        icon: <AppIcon icon="navigation:retirement-policy" fontSize="20px" />,
        showIcon: true,
        roles: DASHBOARD_ROLES,
      },
    ],
  },
  {
    label: "Pemeliharaan Sistem",
    value: "system-maintenance",
    icon: <AppIcon icon="navigation:system-maintenance" fontSize="20px" />,
    roles: [ROLES.SUPERADMIN],
    submenu: [
      {
        label: "Penyimpanan File",
        value: "storage-maintenance",
        path: "/system/storage-maintenance",
        icon: <AppIcon icon="navigation:storage-maintenance" fontSize="20px" />,
        showIcon: true,
        roles: [ROLES.SUPERADMIN],
      },
    ],
  },
];

export default MENU_CONFIG;
