import { ServiceError } from "@/lib/api/routeHelpers";

/** Memastikan organisasi tujuan masih aktif sebelum master organisasi diubah. */
export async function ensureActiveOrganization(client, organizationId) {
  const result = await client.query(
    "SELECT id FROM organizations WHERE id=$1 AND is_active=true FOR SHARE",
    [organizationId],
  );
  if (!result.rowCount)
    throw new ServiceError(
      "ORGANIZATION_INACTIVE",
      "Organisasi tidak ditemukan atau tidak aktif.",
      409,
    );
}
