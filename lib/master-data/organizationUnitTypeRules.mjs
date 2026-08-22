/** Menentukan apakah kode jenis harus dipertahankan demi kestabilan histori/integrasi. */
export function isOrganizationUnitTypeCodeLocked({ usageCount, currentCode, nextCode }) {
  return Number(usageCount) > 0 && currentCode !== nextCode;
}

/** Mengizinkan jenis nonaktif hanya saat unit mempertahankan referensi yang sama. */
export function canAssignOrganizationUnitType({ isActive, typeId, currentTypeId = null }) {
  return Boolean(isActive) || String(typeId) === String(currentTypeId || "");
}
