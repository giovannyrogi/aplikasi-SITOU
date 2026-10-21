/** Status sanksi dibedakan dari status pegawai pada UI dan ekspor. */
export const DISCIPLINARY_ACTION_STATUS = Object.freeze({
  scheduled: ["Sanksi Belum Berlaku", "info"],
  draft: ["Draft Sanksi", "info"],
  active: ["Sanksi Aktif", "success"],
  expired: ["Sanksi Berakhir", "info"],
  revoked: ["Sanksi Dicabut", "danger"],
  appealed: ["Sanksi dalam Banding", "warning"],
  superseded: ["Sanksi Digantikan", "warning"],
});

/** Menjelaskan periode snapshot; null berarti kebijakan tanpa batas waktu. */
export function formatDisciplinaryValidityPeriod(effectiveFrom, effectiveUntil, formatDate) {
  const start = formatDate(effectiveFrom);
  if (effectiveUntil) return `${start} – ${formatDate(effectiveUntil)}`;
  return `Berlaku sejak ${start} · Tanpa batas waktu`;
}
