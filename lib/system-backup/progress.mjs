const categoryLabels = new Map([
  ["pas_foto", "Foto pegawai"], ["foto", "Foto pegawai"],
  ["identitas", "Dokumen identitas"], ["ktp", "Dokumen identitas"],
  ["kk", "Dokumen identitas"], ["npwp", "Dokumen identitas"],
  ["kontrak", "Dokumen kontrak"], ["penempatan", "Dokumen penempatan"],
  ["sanksi", "Dokumen disiplin"], ["pendidikan", "Dokumen pendidikan"],
  ["sertifikasi", "Dokumen sertifikasi"], ["branding", "Logo organisasi"],
]);

/** Hanya label dari daftar tetap yang boleh meninggalkan server; path/nama asli tetap privat. */
export function safeBackupCategory(relativePath) {
  if (relativePath === "database.dump") return "Database";
  if (relativePath === "backup-file-issues.json") return "Laporan pemeriksaan";
  for (const segment of String(relativePath || "").toLowerCase().split(/[\\/]/)) {
    if (categoryLabels.has(segment)) return categoryLabels.get(segment);
  }
  return "File lainnya";
}

/** Persentase hanya untuk total terukur; 100% menunggu konfirmasi tahap selesai. */
export function stagePercent(done, total, complete = false) {
  if (done == null || total == null) return null;
  if (!Number.isSafeInteger(Number(done)) || !Number.isSafeInteger(Number(total)) || Number(total) < 0)
    return null;
  if (Number(total) === 0) return complete ? 100 : null;
  const value = Math.floor(Number(done) / Number(total) * 100);
  return complete ? Math.min(100, value) : Math.min(99, Math.max(0, value));
}
