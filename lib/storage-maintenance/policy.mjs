export const FILE_CLEANUP_RETENTION_DAYS = 7;
export const FILE_CLEANUP_MAX_ATTEMPTS = 5;
export const CLEANABLE_PROFILE_CATEGORIES = Object.freeze([
  "employee_photo",
  "identity",
  "education",
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
  other: "Dokumen lainnya",
});

export const FILE_CLEANUP_REASON_LABELS = Object.freeze({
  retention_expired_unreferenced: "Tidak lagi digunakan dan masa tunggu sudah terpenuhi",
  still_referenced: "Masih digunakan oleh data di sistem",
  active_content_missing: "Metadata aktif tetapi file tidak ditemukan di penyimpanan",
  invalid_storage_path: "Lokasi penyimpanan tidak valid",
  unsupported_provider: "Penyimpanan belum didukung oleh alat pembersihan",
  active_metadata: "File masih berstatus aktif",
  retention_not_met: "Masa tunggu tujuh hari belum terpenuhi",
  category_not_allowed: "Kategori file tidak boleh dibersihkan",
  content_already_absent: "Byte file sudah tidak ada di penyimpanan",
  active_object_key: "Lokasi file juga digunakan oleh metadata aktif",
  organization_mismatch: "Identitas organisasi pada lokasi file tidak sesuai",
  changed_after_scan: "Kondisi file berubah setelah pemeriksaan",
  cleanup_completed: "Byte file berhasil dibersihkan",
  cleanup_failed: "Pembersihan belum berhasil",
});

export const FILE_DELETION_REASON_LABELS = Object.freeze({
  profile_removed: "Dilepas saat profil pegawai diperbarui",
  removed_by_user: "Dihapus oleh pengguna melalui fitur asal",
  replaced: "Diganti dengan file baru",
  draft_expired: "Draft kedaluwarsa",
  legacy_unknown: "Dinonaktifkan sebelum pencatatan alasan tersedia",
});

export function maskEmployeeNumber(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return "-";
  if (normalized.length <= 4) return "*".repeat(normalized.length);
  return `${normalized.slice(0, 2)}${"*".repeat(Math.min(8, normalized.length - 4))}${normalized.slice(-2)}`;
}
