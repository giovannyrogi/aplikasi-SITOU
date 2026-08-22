/** Menentukan organizationId efektif tanpa mempercayai organisasi dari request HRD. */
export function resolveOrganizationScope({
  roleCode,
  sessionOrganizationId,
  requestedOrganizationId,
  optional = false,
}) {
  const requested = requestedOrganizationId ? String(requestedOrganizationId) : null;

  if (roleCode === "superadmin") {
    return !requested && !optional
      ? { organizationId: null, error: "ORGANIZATION_REQUIRED" }
      : { organizationId: requested, error: null };
  }

  const sessionOrganization = sessionOrganizationId ? String(sessionOrganizationId) : null;
  if (!sessionOrganization || (requested && requested !== sessionOrganization)) {
    return { organizationId: null, error: "ORGANIZATION_FORBIDDEN" };
  }

  return { organizationId: sessionOrganization, error: null };
}
