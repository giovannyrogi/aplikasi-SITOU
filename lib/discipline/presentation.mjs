/** Menjelaskan periode snapshot; null berarti kebijakan tanpa batas waktu. */
export function formatDisciplinaryValidityPeriod(effectiveFrom, effectiveUntil, formatDate) {
  const start = formatDate(effectiveFrom);
  if (effectiveUntil) return `${start} – ${formatDate(effectiveUntil)}`;
  return `Berlaku sejak ${start} · Tanpa batas waktu`;
}
