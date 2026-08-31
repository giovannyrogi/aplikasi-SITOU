"use client";

import PrivateFileUpload from "@/app/components/forms/PrivateFileUpload";

const MAX_PDF_BYTES = 10 * 1024 * 1024;

/** Field PDF privat reusable; browser hanya menyimpan metadata file ID dari API. */
export default function PrivatePdfUpload({
  value,
  fileId,
  uploadUrl,
  removeUrl,
  fields = {},
  organizationId,
  onChange,
  onError,
  helpText = "PDF maksimal 10 MB.",
  disabled = false,
  showRemove = true,
  backdropMessages = null,
}) {
  return (
    <PrivateFileUpload
      value={value}
      fileId={fileId}
      uploadUrl={uploadUrl}
      removeUrl={removeUrl}
      fields={fields}
      organizationId={organizationId}
      onChange={onChange}
      onError={onError}
      accept="application/pdf,.pdf"
      maxSizeBytes={MAX_PDF_BYTES}
      emptyTitle="Pilih atau tarik dokumen PDF ke area ini"
      helpText={helpText}
      selectedText="Dokumen tersimpan secara privat"
      disabled={disabled}
      showRemove={showRemove}
      backdropMessages={backdropMessages}
    />
  );
}
