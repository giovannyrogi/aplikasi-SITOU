import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/app/utils/auth";
import { resolvePermissionOrganization } from "@/lib/auth/permissions";
import { readPermissionScope } from "@/lib/access/packageRepository";
import InventoryWorkspace from "./InventoryWorkspace";
import { parsePositiveInteger } from "@/app/utils/apiValidation";
export default async function InventoryPage({ searchParams, section }) {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  const query = await searchParams;
  if (query.organizationId && parsePositiveInteger(query.organizationId, "Organisasi").error)
    redirect("/dashboard");
  let organizationId;
  try {
    organizationId = resolvePermissionOrganization(user, query.organizationId, {
      optional: user.role_code === "superadmin",
    });
  } catch {
    redirect("/dashboard");
  }
  if (organizationId) {
    const permission = `inventory.${section === "master-data" ? "master" : section}.read`;
    const scope = await readPermissionScope(user, organizationId, permission);
    if (scope !== null && !scope.length) redirect("/dashboard");
  }
  return <InventoryWorkspace section={section} />;
}
