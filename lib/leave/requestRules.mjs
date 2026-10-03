export const MAX_LEAVE_ATTACHMENTS = 1;
export const MAX_LEAVE_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_LEAVE_REQUEST_BYTES = 11 * 1024 * 1024;

/** Tanggal kalender dari SQL tetap tanggal lokal organisasi, tanpa konversi timezone host. */
export function leaveBeforeJoinedError(startDate, joinedDate) {
  if (!joinedDate || startDate >= joinedDate) return null;
  const formatted = new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${joinedDate}T00:00:00Z`));
  const message = `Tanggal mulai cuti atau izin tidak boleh sebelum TMT bergabung (${formatted}).`;
  return { code: "LEAVE_BEFORE_JOINED", message, status: 400, fieldErrors: { startDate: message } };
}

/** Referensi lama dan upload baru berbagi batas yang sama sebelum byte disimpan. */
export function leaveAttachmentLimitError(fileIds = [], files = []) {
  if (fileIds.length + files.length <= MAX_LEAVE_ATTACHMENTS) return null;
  const message = "Maksimal satu dokumen pendukung untuk setiap pencatatan cuti atau izin.";
  return {
    code: "LEAVE_ATTACHMENT_LIMIT",
    message,
    status: 400,
    fieldErrors: { attachmentFileIds: message },
  };
}
