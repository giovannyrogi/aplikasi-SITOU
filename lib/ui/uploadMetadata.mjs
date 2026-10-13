/** Membaca metadata file lokal, DTO Kepegawaian, dan DTO Inventaris.
 * Hanya untuk tampilan; MIME byte dan izin tetap diperiksa server.
 */
export function readUploadMetadata(value) {
  return {
    name: value?.name || value?.original_name || value?.originalName || "",
    size: value?.size ?? value?.size_bytes ?? value?.sizeBytes,
    mimeType: value?.type || value?.mime_type || value?.mimeType || "",
  };
}
