export const FILE_CLEANUP_RETENTION_DAYS = 7;
export const FILE_CLEANUP_MAX_ATTEMPTS = 5;
export const ACTIVE_ORPHAN_GRACE_HOURS = 24;
export const FILE_QUARANTINE_DAYS = 7;
export const MAINTENANCE_PREVIEW_MAX_BYTES = 10 * 1024 * 1024;
export const CLEANABLE_PROFILE_CATEGORIES = Object.freeze([
  "employee_photo",
  "identity",
  "education",
]);

export const OFFICIAL_HISTORY_CATEGORIES = Object.freeze([
  "attendance_photo",
  "medical_letter",
  "leave_attachment",
  "contract",
  "assignment_decree",
  "discipline_letter",
  "employee_import_source",
]);

export const MAINTENANCE_INLINE_MIMES = Object.freeze([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

export const STORED_FILE_REFERENCES = Object.freeze([
  { table: "organization_branding", column: "logo_file_id", label: "Branding organisasi" },
  { table: "locations", column: "logo_file_id", label: "Logo lokasi" },
  { table: "employees", column: "profile_photo_file_id", label: "Pas foto pegawai" },
  {
    table: "employee_identifiers",
    column: "document_file_id",
    label: "Identitas pegawai",
  },
  {
    table: "employee_educations",
    column: "certificate_file_id",
    label: "Pendidikan pegawai",
  },
  {
    table: "employee_certifications",
    column: "certificate_file_id",
    label: "Sertifikasi pegawai",
  },
  { table: "employee_documents", column: "file_id", label: "Dokumen pegawai" },
  {
    table: "employee_import_batches",
    column: "source_file_id",
    label: "Import data pegawai",
  },
  {
    table: "employment_contracts",
    column: "document_file_id",
    label: "Histori kontrak",
    official: true,
  },
  {
    table: "employee_assignments",
    column: "document_file_id",
    label: "Histori penempatan",
    official: true,
  },
  {
    table: "employment_contract_document_versions",
    column: "file_id",
    label: "Versi dokumen kontrak",
    official: true,
  },
  {
    table: "employee_assignment_document_versions",
    column: "file_id",
    label: "Versi dokumen penempatan",
    official: true,
  },
  {
    table: "attendance_points",
    column: "reference_background_file_id",
    label: "Referensi titik absensi",
  },
  {
    table: "attendance_import_batches",
    column: "source_file_id",
    label: "Import absensi",
    official: true,
  },
  {
    table: "attendance_events",
    column: "photo_file_id",
    label: "Bukti absensi",
    official: true,
  },
  {
    table: "leave_request_attachments",
    column: "file_id",
    label: "Lampiran cuti atau izin",
    official: true,
  },
  {
    table: "disciplinary_actions",
    column: "document_file_id",
    label: "Surat tindakan disiplin",
    official: true,
  },
]);

export const FILE_CATEGORY_LABELS = Object.freeze({
  employee_photo: "Pas foto",
  identity: "Identitas",
  education: "Pendidikan atau sertifikasi",
  logo: "Logo",
  attendance_photo: "Foto absensi",
  medical_letter: "Surat dokter",
  leave_attachment: "Lampiran cuti atau izin",
  contract: "Kontrak",
  assignment_decree: "Surat penempatan",
  discipline_letter: "Surat tindakan disiplin",
  employee_import_source: "Sumber import pegawai",
  other: "Dokumen lainnya",
});

export const FILE_CLEANUP_REASON_LABELS = Object.freeze({
  retention_expired_unreferenced:
    "File tidak lagi digunakan oleh data aktif dan telah melewati masa tunggu tujuh hari",
  still_referenced: "Masih digunakan oleh data di sistem",
  active_orphan: "Metadata aktif tidak memiliki referensi dan telah melewati masa aman 24 jam",
  draft_active: "File masih terkait draft aktif",
  draft_abandoned: "File terkait draft yang dibuang atau kedaluwarsa",
  filesystem_orphan: "Byte fisik tidak memiliki metadata stored_files",
  temporary_file: "Sisa file sementara ditemukan",
  trash_file: "Sisa file karantina ditemukan",
  official_history: "Dokumen resmi tetap dipertahankan sebagai histori",
  active_content_missing:
    "Catatan file masih aktif, tetapi file fisiknya tidak ditemukan di penyimpanan",
  unreferenced_content_missing:
    "File fisik sudah tidak ada dan metadata tidak lagi digunakan oleh data bisnis",
  invalid_storage_path: "Lokasi penyimpanan tidak valid",
  unsupported_provider: "Jenis penyimpanan belum didukung oleh fitur penghapusan file",
  active_metadata: "File masih tercatat sebagai file aktif",
  retention_not_met: "Masa tunggu tujuh hari belum terpenuhi",
  category_not_allowed: "Kategori file ini tidak boleh dihapus",
  content_already_absent:
    "File fisik sudah dihapus dari penyimpanan; catatan riwayat tetap disimpan",
  active_object_key: "Lokasi file juga digunakan oleh metadata aktif",
  organization_mismatch: "Identitas organisasi pada lokasi file tidak sesuai",
  changed_after_scan: "Kondisi file berubah setelah pemeriksaan",
  cleanup_completed: "File fisik berhasil dihapus; catatan riwayat tetap disimpan",
  cleanup_failed: "File fisik belum berhasil dihapus",
  official_history_detached:
    "Dokumen resmi terlepas dari histori. File dilindungi dan tidak akan dihapus.",
  metadata_status_invalid:
    "File masih digunakan, tetapi status metadatanya terhapus. Pulihkan status file.",
  malware_infected: "Ancaman terdeteksi dan file telah dikarantina.",
  malware_scan_error: "Pemeriksaan antivirus gagal. Jalankan pemeriksaan ulang.",
  quarantined_for_review: "File dipindahkan ke karantina selama tujuh hari.",
  maintenance_approved_cleanup:
    "Superadmin telah memastikan file tidak digunakan dan menyetujuinya untuk dibersihkan.",
  cleanup_waiting_period:
    "File telah dilepas dari status aktif dan sedang menunggu masa aman tujuh hari.",
  content_restored: "Isi file berhasil dipulihkan dari backup dan diverifikasi.",
});

export const ISSUE_PRESENTATION = Object.freeze({
  filesystem_orphan: {
    issueType: "orphan",
    impact: "File memakai ruang penyimpanan tetapi tidak dikenali oleh database.",
    recommendedAction: "Lihat file, lalu pindahkan ke karantina bila tidak dibutuhkan.",
  },
  official_history_detached: {
    issueType: "official_recovery",
    impact: "Dokumen tidak terhubung ke histori, tetapi wajib tetap dilindungi.",
    recommendedAction: "Pulihkan referensi atau pertahankan sebagai arsip resmi.",
  },
  metadata_status_invalid: {
    issueType: "metadata_recovery",
    impact: "Data bisnis masih menunjuk file yang dianggap terhapus.",
    recommendedAction: "Pulihkan status metadata setelah memastikan byte tersedia.",
  },
  active_content_missing: {
    issueType: "content_recovery",
    impact: "Pengguna tidak dapat membuka file yang masih tercatat aktif.",
    recommendedAction: "Pulihkan byte yang sama dari backup.",
  },
  active_orphan: {
    issueType: "unused_active_file",
    impact: "File tidak dipakai data bisnis, tetapi metadata masih berstatus aktif.",
    recommendedAction: "Pindahkan ke proses pembersihan dengan alasan yang dapat diaudit.",
  },
  category_not_allowed: {
    issueType: "protected_category_review",
    impact: "Tidak ada referensi aktif, tetapi kategori ini tidak boleh dihapus otomatis.",
    recommendedAction: "Pertahankan sebagai arsip resmi atau setujui pembersihan bila bukan dokumen resmi.",
  },
  unreferenced_content_missing: {
    issueType: "missing_unused_file",
    impact: "Tidak ada data bisnis yang memakai file dan byte fisiknya memang sudah tidak tersedia.",
    recommendedAction: "Selesaikan catatan pembersihan setelah memeriksa hubungan file.",
  },
  malware_infected: {
    issueType: "security_threat",
    impact: "File berbahaya diblokir dari seluruh preview dan unduhan.",
    recommendedAction: "Biarkan terkarantina atau hapus permanen sekarang.",
  },
  malware_scan_error: {
    issueType: "scanner_error",
    impact: "Keamanan file belum dapat dipastikan.",
    recommendedAction: "Periksa ClamAV lalu jalankan scan ulang.",
  },
});

export const FILE_DELETION_REASON_LABELS = Object.freeze({
  profile_removed: "Dilepas saat profil pegawai diperbarui",
  removed_by_user: "Dihapus oleh pengguna melalui fitur asal",
  replaced: "Diganti dengan file baru",
  draft_discarded: "Draft dibuang dan dimulai ulang",
  draft_expired: "Draft kedaluwarsa",
  upload_abandoned: "Upload tidak pernah diklaim",
  orphan_reconciled: "Orphan dikonfirmasi ulang oleh rekonsiliasi",
  maintenance_approved: "Pembersihan disetujui Superadmin setelah pemeriksaan hubungan file",
  legacy_unknown: "Dinonaktifkan sebelum pencatatan alasan tersedia",
});

export function maskEmployeeNumber(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return "-";
  if (normalized.length <= 4) return "*".repeat(normalized.length);
  return `${normalized.slice(0, 2)}${"*".repeat(Math.min(8, normalized.length - 4))}${normalized.slice(-2)}`;
}
