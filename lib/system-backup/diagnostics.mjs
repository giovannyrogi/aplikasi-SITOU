/** Pesan pekerjaan hanya tersedia untuk Superadmin, namun tetap tidak boleh memuat SQL atau path privat. */
function safePgDumpSummary(stderr) {
  const firstError = String(stderr || "").split(/\r?\n/)
    .find((line) => /^pg_dump:\s*error:/i.test(line.trim()));
  if (!firstError) return null;
  const summary = firstError.replace(/^\s*pg_dump:\s*error:\s*/i, "")
    .replace(/\b(?:query failed|error):\s*/gi, "")
    .replace(/(["'`])(?:\\.|(?!\1).)*\1/g, "[disamarkan]")
    .replace(/(?:[A-Za-z]:\\|\/)[^\s,;)]*/g, "[lokasi]")
    .replace(/[\r\n\x00-\x1f\x7f]/g, " ")
    .replace(/\s+/g, " ").trim();
  if (!summary || /\b(password|secret|token|credential)\b/i.test(summary)) return null;
  return summary.slice(0, 180);
}

export function describeBackupFailure(error, phase = "persiapan") {
  const message = String(error?.message || "");
  const stage = {
    preparation: "menyiapkan backup",
    version: "memeriksa pg_dump",
    snapshot: "menyalin data dan file",
    dump: "mencadangkan database",
    validation: "memeriksa file",
    package: "mengamankan paket",
    verify: "memeriksa hasil",
  }[phase] || "menyiapkan backup";
  const withStage = (failure) => ({ ...failure, message: `Saat ${stage}: ${failure.message}` });
  if (error?.code === "ENOENT" && error?.source === "pg_dump") return withStage({
    code: "PG_DUMP_NOT_FOUND",
    message: "Program pg_dump tidak ditemukan. Periksa PG_DUMP_PATH pada server aplikasi.",
  });
  if (error?.source === "backup_output") return withStage({
    code: "BACKUP_OUTPUT_UNAVAILABLE",
    message: "File sementara backup tidak dapat dibuat. Periksa izin dan ruang penyimpanan server.",
  });
  if (/Versi pg_dump lebih lama/i.test(message)) return withStage({
    code: "PG_DUMP_VERSION_OLD",
    message: "Versi pg_dump lebih lama daripada server PostgreSQL. Gunakan klien yang sesuai.",
  });
  if (error?.commandStderr != null) {
    const detail = String(error.commandStderr);
    if (/permission denied|must be owner/i.test(detail)) return withStage({
      code: "PG_DUMP_PERMISSION_DENIED",
      message: "Akun database tidak memiliki izin untuk mencadangkan seluruh data. Periksa hak aksesnya.",
    });
    if (/snapshot/i.test(detail)) return withStage({
      code: "PG_DUMP_SNAPSHOT_FAILED",
      message: "Snapshot database ditolak oleh pg_dump. Periksa konfigurasi dan transaksi backup.",
    });
    if (/authentication failed|could not connect|connection refused/i.test(detail)) return withStage({
      code: "PG_DUMP_CONNECTION_FAILED",
      message: "pg_dump tidak dapat terhubung ke database. Periksa koneksi dan kredensial server.",
    });
    const summary = safePgDumpSummary(detail);
    return withStage({
      code: "PG_DUMP_FAILED",
      message: summary
        ? `Pencadangan database gagal. Detail pg_dump: ${summary}`
        : "Pencadangan database gagal. Periksa pg_dump dan log server.",
    });
  }
  if (/file.*digunakan|file.*berubah/i.test(message)) return withStage({
    code: error?.code || "BACKUP_FILE_CHANGED",
    message: "Ada file yang masih digunakan tetapi hilang atau berubah. Periksa menu Penyimpanan File.",
  });
  if (/jeda|120/i.test(message)) return withStage({
    code: error?.code || "BACKUP_PAUSE_TIMEOUT",
    message: "Jeda perubahan melebihi dua menit. Coba lagi saat sistem lebih sepi.",
  });
  if (/ruang penyimpanan/i.test(message)) return withStage({
    code: error?.code || "BACKUP_SPACE_INSUFFICIENT",
    message: "Ruang penyimpanan server tidak cukup untuk membuat backup.",
  });
  return withStage({
    code: error?.code || "BACKUP_FAILED",
    message: "Backup gagal. Periksa ruang penyimpanan dan log server.",
  });
}
