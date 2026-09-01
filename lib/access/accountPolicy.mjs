export function resolveAccountRoleForActor(actorRoleCode, requestedRoleCode) {
  return actorRoleCode === "hrd" ? "employee" : requestedRoleCode;
}

export function canManageOrganizationAccountRole(actorRoleCode, targetRoleCode) {
  return (
    actorRoleCode === "superadmin" || (actorRoleCode === "hrd" && targetRoleCode === "employee")
  );
}

export function normalizeAccountInputForActor(input, actorRoleCode) {
  const roleCode = resolveAccountRoleForActor(actorRoleCode, input.roleCode);
  return roleCode === "employee"
    ? { ...input, roleCode, locationScopeMode: "all", locationIds: [] }
    : { ...input, roleCode };
}
