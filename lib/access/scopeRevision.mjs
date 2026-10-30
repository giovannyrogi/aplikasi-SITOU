import { createHash } from "node:crypto";

const sortedIds = (values = []) => [...new Set(values.map(String))].sort();

/** Penanda perubahan cakupan untuk penyegaran UI, bukan bukti otorisasi. */
export function scopeRevisionFromState({
  organizationId,
  membershipId,
  locationMode,
  locationIds,
  packages,
  modules = [],
}) {
  const grants = packages
    .map((grant) => ({
      code: grant.code,
      mode: grant.mode,
      moduleEnabled: Boolean(grant.moduleEnabled),
      warehouseIds: sortedIds(grant.warehouseIds),
    }))
    .sort((a, b) => {
      const left = JSON.stringify(a);
      const right = JSON.stringify(b);
      return left < right ? -1 : left > right ? 1 : 0;
    });
  const state = {
    organizationId: String(organizationId),
    membershipId: String(membershipId),
    locationMode: locationMode || "all",
    locationIds: locationMode === "selected" ? sortedIds(locationIds) : [],
    packages: grants,
    modules: modules
      .map((row) => ({ code: row.code, enabled: Boolean(row.enabled) }))
      .sort((a, b) => a.code.localeCompare(b.code)),
  };
  return createHash("sha256").update(JSON.stringify(state)).digest("hex");
}
