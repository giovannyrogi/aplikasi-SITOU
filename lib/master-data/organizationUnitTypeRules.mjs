/** Mengizinkan jenis nonaktif hanya saat unit mempertahankan referensi yang sama. */
export function canAssignOrganizationUnitType({ isActive, typeId, currentTypeId = null }) {
  return Boolean(isActive) || String(typeId) === String(currentTypeId || "");
}
