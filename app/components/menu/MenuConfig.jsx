import { Icon } from "@iconify/react";
import AccountTreeRoundedIcon from "@mui/icons-material/AccountTreeRounded";
import CategoryRoundedIcon from "@mui/icons-material/CategoryRounded";
import { ROLES } from "./ConstantRoles";

const DASHBOARD_ROLES = [ROLES.SUPERADMIN, ROLES.HRD, ROLES.LEADER];

const MENU_CONFIG = [
  {
    label: "Dashboard",
    value: "dashboard",
    path: "/dashboard",
    icon: <Icon icon="solar:widget-5-bold-duotone" fontSize="20px" />,
    roles: DASHBOARD_ROLES,
  },
  {
    label: "Data Master",
    value: "master-data",
    icon: <Icon icon="solar:database-bold-duotone" fontSize="20px" />,
    roles: [ROLES.SUPERADMIN, ROLES.HRD],
    submenu: [
      {
        label: "Organisasi",
        value: "master-organizations",
        path: "/master-data/organizations",
        icon: <Icon icon="solar:buildings-3-bold-duotone" fontSize="20px" />,
        showIcon: true,
        roles: [ROLES.SUPERADMIN],
      },
      {
        label: "Lokasi",
        value: "master-locations",
        path: "/master-data/locations",
        icon: <Icon icon="solar:map-point-wave-bold-duotone" fontSize="20px" />,
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
        icon: <Icon icon="solar:case-round-bold-duotone" fontSize="20px" />,
        showIcon: true,
        roles: [ROLES.SUPERADMIN, ROLES.HRD],
      },
      {
        label: "Jenis Kepegawaian",
        value: "master-employment-types",
        path: "/master-data/employment-types",
        icon: <Icon icon="solar:document-add-bold-duotone" fontSize="20px" />,
        showIcon: true,
        roles: [ROLES.SUPERADMIN, ROLES.HRD],
      },
      {
        label: "Admin Organisasi",
        value: "master-admin-users",
        path: "/master-data/admin-users",
        icon: <Icon icon="solar:user-id-bold-duotone" fontSize="20px" />,
        showIcon: true,
        roles: [ROLES.SUPERADMIN],
      },
    ],
  },
  {
    label: "Kepegawaian",
    value: "employees-module",
    icon: <Icon icon="solar:users-group-rounded-bold-duotone" fontSize="20px" />,
    roles: [ROLES.SUPERADMIN, ROLES.HRD, ROLES.LEADER],
    submenu: [
      {
        label: "Data Pegawai",
        value: "employees",
        path: "/employees",
        icon: <Icon icon="solar:user-id-bold-duotone" fontSize="20px" />,
        showIcon: true,
        roles: [ROLES.SUPERADMIN, ROLES.HRD, ROLES.LEADER],
      },
    ],
  },
  {
    label: "Akun & Akses",
    value: "access-module",
    icon: <Icon icon="solar:key-bold-duotone" fontSize="20px" />,
    roles: [ROLES.SUPERADMIN, ROLES.HRD],
    submenu: [
      {
        label: "Akun Organisasi",
        value: "organization-accounts",
        path: "/access/accounts",
        icon: <Icon icon="solar:shield-user-bold-duotone" fontSize="20px" />,
        showIcon: true,
        roles: [ROLES.SUPERADMIN, ROLES.HRD],
      },
    ],
  },
];

export default MENU_CONFIG;
