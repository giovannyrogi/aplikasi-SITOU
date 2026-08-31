"use client";

import { readApiResponse } from "@/lib/api/clientError";

import { useEffect, useRef, useState } from "react";
import FileUploadField from "@/app/components/forms/FileUploadField";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";

/** Mengunggah satu file privat dan hanya menyimpan metadata ID yang dikembalikan API. */
export default function PrivateFileUpload({
  value,
  fileId,
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
  onRemoveRequest,
  deferred = false,
  backdropMessages = null,
}) {
  const [uploading, setUploading] = useState(false);
  const { runWithLoadingBackdrop } = useLoadingBackdrop();
  const localPreviewRef = useRef(null);
  // Metadata join dapat tidak lengkap, tetapi ID dari API tetap cukup untuk menampilkan file privat tersimpan.
  const storedValue =
    value ||
    (fileId
      ? {
          id: String(fileId),
          name: "File tersimpan",
        }
      : null);
  const resolvedFileId = storedValue?.id || (fileId ? String(fileId) : null);
  const resolvedRemoveUrl =
    removeUrl ||
    (resolvedFileId && organizationId
      ? `/api/uploads/${resolvedFileId}?organizationId=${organizationId}`
      : null);

  /** URL blob hanya hidup selama komponen pemilih file masih digunakan. */
  useEffect(
    () => () => {
      if (localPreviewRef.current) URL.revokeObjectURL(localPreviewRef.current);
    },
    [],
  );

  /** Server tetap menjadi pemeriksa akhir MIME; batas klien hanya memberi feedback lebih cepat. */
  const upload = async (file) => {
    if (maxSizeBytes && file.size > maxSizeBytes) {
      onError?.(`Ukuran file melebihi batas ${(maxSizeBytes / 1024 / 1024).toFixed(0)} MB.`);
      return;
    }
    if (deferred) {
      if (localPreviewRef.current) URL.revokeObjectURL(localPreviewRef.current);
      localPreviewRef.current = file.type.startsWith("image/") ? URL.createObjectURL(file) : null;
      onChange?.({
        name: file.name,
        original_name: file.name,
        type: file.type,
        mime_type: file.type,
        size: file.size,
        size_bytes: file.size,
        localFile: file,
        uploadToken: crypto.randomUUID(),
        previewUrl: localPreviewRef.current,
        pending: true,
      });
      return;
    }
    setUploading(true);
    try {
      const processUpload = async () => {
        const form = new FormData();
        form.append("file", file);
        form.append("organizationId", organizationId);
        Object.entries(fields).forEach(([key, fieldValue]) => form.append(key, fieldValue));
        const response = await fetch(uploadUrl, { method: "POST", body: form });
        const body = await readApiResponse(response, "File tidak dapat diunggah.");
        onChange(body.data);
      };
      if (backdropMessages?.upload)
        await runWithLoadingBackdrop(processUpload, { message: backdropMessages.upload });
      else await processUpload();
    } catch (error) {
      onError?.(error.message);
    } finally {
      setUploading(false);
    }
  };

  /** Hapus memakai endpoint berizin dan baru membersihkan state setelah server berhasil. */
  const remove = async () => {
    if (!storedValue) return false;
    if (onRemoveRequest) {
      onRemoveRequest({ file: storedValue, fileId: resolvedFileId });
      return false;
    }
    if (deferred) {
      if (localPreviewRef.current) URL.revokeObjectURL(localPreviewRef.current);
      localPreviewRef.current = null;
      onChange?.(null);
      return true;
    }
    if (!resolvedRemoveUrl) return false;
    setUploading(true);
    try {
      const processRemove = async () => {
        const response = await fetch(resolvedRemoveUrl, { method: "DELETE" });
        await readApiResponse(response, "File tidak dapat dihapus.");
        onChange?.(null);
        return true;
      };
      if (backdropMessages?.remove)
        return await runWithLoadingBackdrop(processRemove, { message: backdropMessages.remove });
      return await processRemove();
    } catch (error) {
      onError?.(error.message);
      return false;
    } finally {
      setUploading(false);
    }
  };

  return (
    <FileUploadField
      value={storedValue}
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
      previewUrl={
        storedValue?.previewUrl ||
        (resolvedFileId
          ? `/api/uploads/${resolvedFileId}?organizationId=${organizationId}`
          : undefined)
      }
      showRemove={showRemove}
    />
  );
}
