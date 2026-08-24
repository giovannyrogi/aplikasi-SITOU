import { ALL_ROLE_CODES, ROLES } from "@/app/constants/roles";

export const PUBLIC_PATHS = ["/login", "/forgot-password"];

export const PUBLIC_PATH_PREFIXES = ["/verify"];

export const PROTECTED_ROUTES = [
  {
    path: "/profile",
    roles: ALL_ROLE_CODES,
  },
  {
    path: "/dashboard",
    roles: [ROLES.SUPERADMIN, ROLES.HRD, ROLES.LEADER, ROLES.EMPLOYEE],
  },
  {
    path: "/master-data/organizations",
    roles: [ROLES.SUPERADMIN],
  },
  {
    path: "/master-data/admin-users",
    roles: [ROLES.SUPERADMIN],
  },
  {
    path: "/master-data",
    roles: [ROLES.SUPERADMIN, ROLES.HRD],
  },
  {
    path: "/employees",
    roles: [ROLES.SUPERADMIN, ROLES.HRD, ROLES.LEADER],
  },
  {
    path: "/employee-assignments",
    roles: [ROLES.SUPERADMIN, ROLES.HRD, ROLES.LEADER],
  },
  {
    path: "/employment-contracts",
    roles: [ROLES.SUPERADMIN, ROLES.HRD, ROLES.LEADER],
  },
  {
    path: "/discipline",
    roles: [ROLES.SUPERADMIN, ROLES.HRD, ROLES.LEADER],
  },
  {
    path: "/access",
    roles: [ROLES.SUPERADMIN, ROLES.HRD],
  },
];

export const isPublicPath = (pathname) =>
  PUBLIC_PATHS.includes(pathname) ||
  PUBLIC_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

export const getAllowedRolesForPath = (pathname) => {
  const matchedRoute = PROTECTED_ROUTES.find(
    (route) => pathname === route.path || pathname.startsWith(`${route.path}/`),
  );

  return matchedRoute?.roles || ALL_ROLE_CODES;
};
