/** Field administratif per jenis; kontrak referenceNo dan data lama tetap dipertahankan. */
export const TRANSACTION_DOCUMENT_FIELDS = Object.freeze({
  receipt:{label:"Nomor dokumen penerimaan (opsional)",summaryLabel:"Nomor dokumen penerimaan",placeholder:"Contoh: NOTA-2026-001",description:"Isi nomor nota, kuitansi, atau surat jalan jika tersedia."},
  issue:{label:"Nomor memo/permintaan (opsional)",summaryLabel:"Nomor memo/permintaan",placeholder:"Contoh: MEMO-2026-001",description:"Isi nomor memo atau surat permintaan yang menjadi dasar penyaluran jika tersedia."},
});
export function requiresLateReason(kind,occurredOn,today) {
  return ["receipt","issue","return","stocktake"].includes(kind) && !!occurredOn && !!today && occurredOn<today;
}
export function transactionDocumentField(kind) {return TRANSACTION_DOCUMENT_FIELDS[kind] || null;}
export function transactionReferenceLabel(kind) {return transactionDocumentField(kind)?.summaryLabel || "Nomor referensi tersimpan";}
