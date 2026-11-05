import pool from "@/lib/dbConfig";
import { ServiceError } from "@/lib/api/routeHelpers";
import { writeAudit } from "@/lib/audit";
import { fetchProviderYear } from "./provider.mjs";
import { checkCatalogYear } from "./service";
/** Preview only. Normal draft save/publication remains the sole catalog write path. */
export async function fetchCatalogSource(actor, input, requestId) {
  if (actor.role_code !== "superadmin")
    throw new ServiceError("FORBIDDEN", "Khusus Admin SITOU.", 403);
  await checkCatalogYear(pool, input);
  const { year } = input;
  const result = await fetchProviderYear(year);
  await writeAudit(pool, {
    actorUserId: actor.id,
    action: "holiday_catalog.source_preview",
    entityType: "holiday_catalog_year",
    entityId: year,
    requestId,
    afterData: { ...result, state: "preview_only" },
  });
  return result;
}
