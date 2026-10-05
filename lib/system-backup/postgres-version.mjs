/** Membaca versi PostgreSQL tanpa mengambil nomor paket Ubuntu/Debian di belakangnya. */
export function parsePgDumpMajorVersion(output) {
  const match = String(output || "")
    .trim()
    .match(/^pg_dump\s+\(PostgreSQL\)\s+(\d+)(?:\.\d+)*(?=\s|$)/i);
  if (!match) return null;
  const major = Number(match[1]);
  return Number.isSafeInteger(major) && major > 0 ? major : null;
}
