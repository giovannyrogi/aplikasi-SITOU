import { createHash } from "node:crypto";
import pool from "@/lib/dbConfig";
import { ServiceError } from "@/lib/api/routeHelpers";
import { getActorLocationScope } from "@/lib/auth/permissions";
import { dashboardAccessFingerprint, dashboardSectionsFor } from "./accessPolicy.mjs";
import { dashboardActivityAccess, mapActivities } from "./activityAccess.mjs";
import { buildOrganizationActivityHistorySql } from "./activityQuery.mjs";
import { decodeActivityCursor, encodeActivityCursor } from "./activityCursor.mjs";

/** Riwayat organisasi hanya bagi HRD; target selalu dipetakan dari sesi server. */
export async function readDashboardActivityHistory(actor, encoded, database = pool, pageSize = 10) {
  if (actor.role_code !== "hrd" || !actor.organization_id || !dashboardSectionsFor(actor).length)
    throw new ServiceError("FORBIDDEN", "Anda tidak memiliki akses ke riwayat aktivitas ini.", 403);
  if (![10, 20, 50].includes(pageSize))
    throw new ServiceError("VALIDATION_ERROR", "Jumlah data per halaman tidak valid.", 400);
  const locations = await getActorLocationScope(actor, database);
  const access = dashboardActivityAccess(actor);
  const scope = createHash("sha256")
    .update(
      JSON.stringify({
        user: String(actor.id),
        organization: String(actor.organization_id),
        role: actor.role_code,
        pageSize,
        locations: locations === null ? null : [...locations].map(String).sort(),
        access: dashboardAccessFingerprint(actor),
      }),
    )
    .digest("hex");
  let cursor;
  try {
    cursor = decodeActivityCursor(encoded, scope);
  } catch {
    throw new ServiceError(
      "CURSOR_INVALID",
      "Riwayat berubah. Tutup lalu buka kembali riwayat aktivitas.",
      400,
    );
  }
  const result = await database.query(buildOrganizationActivityHistorySql(), [
    actor.organization_id,
    locations,
    access.activityActions,
    access.reportKinds,
    access.canManageAllAccountRoles,
    cursor?.time || null,
    cursor?.id || null,
    pageSize + 1,
  ]);
  const snapshot = result.rows[0];
  const rows = snapshot.items.slice(0, pageSize);
  return {
    items: mapActivities(rows),
    total: snapshot.total,
    nextCursor: snapshot.items.length > pageSize ? encodeActivityCursor(rows.at(-1), scope) : null,
  };
}
