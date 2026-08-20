import { Icon } from "@iconify/react";
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
    roles: [ROLES.SUPERADMIN],
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
        roles: [ROLES.SUPERADMIN],
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
];

export default MENU_CONFIG;
