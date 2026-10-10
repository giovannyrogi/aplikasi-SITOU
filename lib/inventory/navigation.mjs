/** Memetakan tautan lama tanpa parameter asing atau organisasi invalid. */
export function inventoryLegacyDestination(section, query = {}) {
  const kinds = ["items", "categories", "units", "warehouses"];
  const kind = kinds.includes(query.tab) ? query.tab : "items";
  const route =
    section === "reports" ? "/reports/inventory-distribution" : `/master-data/inventory-${kind}`;
  const org = query.organizationId;
  return typeof org === "string" && /^[1-9]\d*$/.test(org) && Number.isSafeInteger(Number(org))
    ? `${route}?organizationId=${org}`
    : route;
}
