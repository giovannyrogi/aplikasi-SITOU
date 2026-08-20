import { normalizeRoleCode, ROLES } from "@/app/constants/roles";

export const DEFAULT_ROUTE_BY_ROLE = {
  [ROLES.SUPERADMIN]: "/dashboard",
  [ROLES.HRD]: "/dashboard",
  [ROLES.LEADER]: "/dashboard",
  [ROLES.EMPLOYEE]: "/dashboard",
};

export const getDefaultRouteByRole = (role) =>
  DEFAULT_ROUTE_BY_ROLE[normalizeRoleCode(role)] || "/dashboard";
