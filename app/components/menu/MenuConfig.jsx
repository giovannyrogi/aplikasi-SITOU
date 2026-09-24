import AppIcon from "@/app/components/icons/AppIcon";
import AccountTreeRoundedIcon from "@mui/icons-material/AccountTreeRounded";
import CategoryRoundedIcon from "@mui/icons-material/CategoryRounded";
import { ROLES } from "./ConstantRoles";

const DASHBOARD_ROLES = [ROLES.SUPERADMIN, ROLES.HRD, ROLES.LEADER];

const MENU_CONFIG = [
  {
    label: "Dashboard",
    value: "dashboard",
    path: "/dashboard",
    icon: <AppIcon icon="solar:widget-5-bold-duotone" fontSize="20px" />,
    roles: DASHBOARD_ROLES,
  },
  {
    label: "Data Master",
    value: "master-data",
    icon: <AppIcon icon="solar:database-bold-duotone" fontSize="20px" />,
    roles: [ROLES.SUPERADMIN, ROLES.HRD],
    submenu: [
      {
        label: "Organisasi",
        value: "master-organizations",
        path: "/master-data/organizations",
        icon: <AppIcon icon="solar:buildings-3-bold-duotone" fontSize="20px" />,
        showIcon: true,
        roles: [ROLES.SUPERADMIN],
      },
      {
        label: "Lokasi",
        value: "master-locations",
        path: "/master-data/locations",
        icon: <AppIcon icon="solar:map-point-wave-bold-duotone" fontSize="20px" />,
        showIcon: true,
        roles: [ROLES.SUPERADMIN, ROLES.HRD],
      },
      {
        label: "Jenis Unit Organisasi",
        value: "master-organization-unit-types",
        path: "/master-data/organization-unit-types",
        icon: <CategoryRoundedIcon sx={{ fontSize: 20 }} />,
        showIcon: true,
        roles: [ROLES.SUPERADMIN, ROLES.HRD],
      },
      {
        label: "Divisi & Unit",
        value: "master-organization-units",
        path: "/master-data/organization-units",
        icon: <AccountTreeRoundedIcon sx={{ fontSize: 20 }} />,
        showIcon: true,
        roles: [ROLES.SUPERADMIN, ROLES.HRD],
      },
      {
        label: "Jabatan",
        value: "master-positions",
        path: "/master-data/positions",
        icon: <AppIcon icon="solar:case-round-bold-duotone" fontSize="20px" />,
        showIcon: true,
        roles: [ROLES.SUPERADMIN, ROLES.HRD],
      },
      {
        label: "Jenis Kepegawaian",
        value: "master-employment-types",
        path: "/master-data/employment-types",
        icon: <AppIcon icon="solar:document-add-bold-duotone" fontSize="20px" />,
        showIcon: true,
        roles: [ROLES.SUPERADMIN, ROLES.HRD],
      },
    ],
  },
  {
    label: "Kepegawaian",
    value: "employees-module",
    icon: <AppIcon icon="solar:users-group-rounded-bold-duotone" fontSize="20px" />,
    roles: [ROLES.SUPERADMIN, ROLES.HRD, ROLES.LEADER],
    submenu: [
      {
        label: "Data Pegawai",
        value: "employees",
        path: "/employees",
        icon: <AppIcon icon="solar:user-id-bold-duotone" fontSize="20px" />,
        showIcon: true,
        roles: [ROLES.SUPERADMIN, ROLES.HRD, ROLES.LEADER],
      },
      {
        label: "Cuti & Izin",
        value: "leave-requests",
        path: "/leave-requests",
        icon: <AppIcon icon="solar:calendar-mark-bold-duotone" fontSize="20px" />,
        showIcon: true,
        roles: [ROLES.SUPERADMIN, ROLES.HRD, ROLES.LEADER],
      },
    ],
  },
  {
    label: "Laporan",
    value: "reports",
    icon: <AppIcon icon="solar:chart-2-bold-duotone" fontSize="20px" />,
    roles: DASHBOARD_ROLES,
    submenu: [
      {
        label: "Kontrak Akan Berakhir",
        value: "expiring-contracts-report",
        path: "/reports/expiring-contracts",
        icon: <AppIcon icon="clarity:contract-solid" fontSize="20px" />,
        showIcon: true,
        roles: DASHBOARD_ROLES,
      },
      {
        label: "Proyeksi Pensiun",
        value: "retirement-report",
        path: "/reports/retirements",
        icon: <AppIcon icon="fa6-solid:people-group" fontSize="20px" />,
        showIcon: true,
        roles: DASHBOARD_ROLES,
      },
      {
        label: "Sanksi Pegawai",
        value: "disciplinary-actions-report",
        path: "/reports/disciplinary-actions",
        icon: <AppIcon icon="solar:shield-warning-bold-duotone" fontSize="20px" />,
        showIcon: true,
        roles: DASHBOARD_ROLES,
      },
    ],
  },
  {
    label: "Akun & Akses",
    value: "access-module",
    icon: <AppIcon icon="solar:key-bold-duotone" fontSize="20px" />,
    roles: [ROLES.SUPERADMIN, ROLES.HRD],
    submenu: [
      {
        label: "Akun Organisasi",
        value: "organization-accounts",
        path: "/access/accounts",
        icon: <AppIcon icon="solar:shield-user-bold-duotone" fontSize="20px" />,
        showIcon: true,
        roles: [ROLES.SUPERADMIN, ROLES.HRD],
      },
    ],
  },
  {
    label: "Pengaturan Organisasi",
    value: "organization-settings",
    icon: <AppIcon icon="solar:settings-bold-duotone" fontSize="20px" />,
    roles: DASHBOARD_ROLES,
    submenu: [
      {
        label: "Aturan Cuti & Izin",
        value: "leave-settings",
        path: "/organization-settings/leave-types",
        icon: <AppIcon icon="solar:calendar-minimalistic-bold-duotone" fontSize="20px" />,
        showIcon: true,
        roles: [ROLES.SUPERADMIN, ROLES.HRD],
      },
      {
        label: "Pengaturan Sanksi",
        value: "disciplinary-action-settings",
        path: "/organization-settings/disciplinary-actions",
        icon: <AppIcon icon="solar:shield-warning-bold-duotone" fontSize="20px" />,
        showIcon: true,
        roles: [ROLES.SUPERADMIN, ROLES.HRD],
      },
      {
        label: "Kebijakan Pensiun",
        value: "retirement-policy",
        path: "/organization-settings/retirement",
        icon: <AppIcon icon="solar:calendar-date-bold-duotone" fontSize="20px" />,
        showIcon: true,
        roles: DASHBOARD_ROLES,
      },
    ],
  },
  {
    label: "Pemeliharaan Sistem",
    value: "system-maintenance",
    icon: <AppIcon icon="solar:settings-minimalistic-bold-duotone" fontSize="20px" />,
    roles: [ROLES.SUPERADMIN],
    submenu: [
      {
        label: "Penyimpanan File",
        value: "storage-maintenance",
        path: "/system/storage-maintenance",
        icon: <AppIcon icon="solar:folder-with-files-bold-duotone" fontSize="20px" />,
        showIcon: true,
        roles: [ROLES.SUPERADMIN],
      },
    ],
  },
];

export default MENU_CONFIG;
