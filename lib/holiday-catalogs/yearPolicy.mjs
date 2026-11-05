export async function lockCatalogYear(db, year) {
  await db.query("SELECT pg_advisory_xact_lock(69000,$1)", [year]);
}

export function catalogYearConflict({ draft, published, id, revisionOf }) {
  if (draft && String(draft.id) !== id)
    return {
      code: "DRAFT_EXISTS",
      message: "Draft tahun ini sudah tersedia. Buka draft tersebut.",
    };
  if (id && !draft)
    return { code: "VERSION_CONFLICT", message: "Draft berubah. Muat ulang sebelum melanjutkan." };
  const base = draft ? draft.revision_of_id : revisionOf;
  if (base && (!published || String(published.id) !== String(base)))
    return {
      code: "CATALOG_REVISION_STALE",
      message: "Katalog acuan berubah. Mulai revisi dari katalog terbit terbaru.",
    };
  if (published && !base)
    return {
      code: "CATALOG_YEAR_PUBLISHED",
      message:
        "Katalog tahun ini sudah terbit. Lihat katalog atau pilih Edit katalog jika ada perubahan resmi.",
    };
  return null;
}

export function sameCatalogContents(a, b) {
  const days = (catalog) =>
    catalog.days
      .map(({ date, name, category }) => [date, name, category])
      .sort(([left], [right]) => left.localeCompare(right));
  return (
    a.decisionNumber === b.decisionNumber &&
    a.sourceUrl === b.sourceUrl &&
    JSON.stringify(days(a)) === JSON.stringify(days(b))
  );
}
