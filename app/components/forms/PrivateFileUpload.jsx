"use client";

import { useState } from "react";
import FileUploadField from "@/app/components/forms/FileUploadField";

/** Mengunggah satu file privat dan hanya menyimpan metadata ID yang dikembalikan API. */
export default function PrivateFileUpload({
  value,
  uploadUrl,
  removeUrl,
  fields = {},
  organizationId,
  onChange,
  onError,
  accept,
  maxSizeBytes,
  emptyTitle,
  helpText,
  selectedText = "File tersimpan secara privat",
  disabled = false,
  showRemove = true,
}) {
  const [uploading, setUploading] = useState(false);

  /** Server tetap menjadi pemeriksa akhir MIME; batas klien hanya memberi feedback lebih cepat. */
  const upload = async (file) => {
    if (maxSizeBytes && file.size > maxSizeBytes) {
      onError?.(`Ukuran file melebihi batas ${(maxSizeBytes / 1024 / 1024).toFixed(0)} MB.`);
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("organizationId", organizationId);
      Object.entries(fields).forEach(([key, fieldValue]) => form.append(key, fieldValue));
      const response = await fetch(uploadUrl, { method: "POST", body: form });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "File tidak dapat diunggah.");
      onChange(body.data);
    } catch (error) {
      onError?.(error.message);
    } finally {
      setUploading(false);
    }
  };

  /** Hapus memakai endpoint berizin dan baru membersihkan state setelah server berhasil. */
  const remove = async () => {
    if (!value || !removeUrl) return true;
    setUploading(true);
    try {
      const response = await fetch(removeUrl, { method: "DELETE" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "File tidak dapat dihapus.");
      onChange(null);
      return true;
    } catch (error) {
      onError?.(error.message);
      return false;
    } finally {
      setUploading(false);
    }
  };

  return (
    <FileUploadField
      value={value}
      accept={accept}
      maxSizeBytes={maxSizeBytes}
      emptyTitle={emptyTitle}
      helpText={helpText}
      selectedText={selectedText}
      disabled={disabled}
      loading={uploading}
      onSelect={upload}
      onRemove={remove}
      onError={onError}
      previewUrl={value ? `/api/uploads/${value.id}?organizationId=${organizationId}` : undefined}
      showRemove={showRemove}
    />
  );
}
