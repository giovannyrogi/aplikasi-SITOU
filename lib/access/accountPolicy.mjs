export function resolveAccountRoleForActor(actorRoleCode, requestedRoleCode, fullAdmin = false) {
  return actorRoleCode === "hrd" && !fullAdmin ? "employee" : requestedRoleCode;
}

export function canManageOrganizationAccountRole(actorRoleCode, targetRoleCode, fullAdmin = false) {
  return (
    actorRoleCode === "superadmin" ||
    (actorRoleCode === "hrd" &&
      (targetRoleCode === "employee" || (fullAdmin && ["hrd", "leader"].includes(targetRoleCode))))
  );
}

export function normalizeAccountInputForActor(input, actorRoleCode, fullAdmin = false) {
  const roleCode = resolveAccountRoleForActor(actorRoleCode, input.roleCode, fullAdmin);
  return roleCode === "employee"
    ? { ...input, roleCode, locationScopeMode: "all", locationIds: [] }
    : { ...input, roleCode };
}
