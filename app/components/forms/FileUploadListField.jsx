"use client";

import { useEffect, useRef } from "react";
import { Box } from "@mui/material";
import FileUploadField from "@/app/components/forms/FileUploadField";

/** Koleksi file lokal reusable yang tetap memakai dropzone dan validasi FileUploadField. */
export default function FileUploadListField({
  value = [],
  onChange,
  onError,
  accept,
  maxSizeBytes,
  maxCount = 5,
  emptyTitle = "Pilih atau tarik file ke area ini",
  helpText,
  selectedText = "File terpilih dan akan disimpan bersama data",
  disabled = false,
  fullWidth = false,
}) {
  const previewUrls = useRef(new Map());

  const createEntry = (file, uid = crypto.randomUUID()) => {
    const previousUrl = previewUrls.current.get(uid);
    if (previousUrl) URL.revokeObjectURL(previousUrl);
    const previewUrl = URL.createObjectURL(file);
    previewUrls.current.set(uid, previewUrl);
    return {
      uid,
      name: file.name,
      type: file.type,
      size: file.size,
      localFile: file,
      previewUrl,
    };
  };

  const addFile = async (file) => {
    if (value.length >= maxCount) {
      onError?.(`Maksimal ${maxCount} file dapat dipilih.`);
      return;
    }
    onChange?.([...value, createEntry(file)]);
  };

  const replaceFile = async (index, file) => {
    const next = [...value];
    next[index] = createEntry(file, next[index].uid);
    onChange?.(next);
  };

  const removeFile = async (index) => {
    const entry = value[index];
    const previewUrl = previewUrls.current.get(entry.uid);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrls.current.delete(entry.uid);
    onChange?.(value.filter((_, itemIndex) => itemIndex !== index));
  };

  useEffect(() => {
    const activeIds = new Set(value.map((entry) => entry.uid));
    for (const [uid, previewUrl] of previewUrls.current) {
      if (!activeIds.has(uid)) {
        URL.revokeObjectURL(previewUrl);
        previewUrls.current.delete(uid);
      }
    }
  }, [value]);

  useEffect(
    () => () => {
      for (const previewUrl of previewUrls.current.values()) URL.revokeObjectURL(previewUrl);
      previewUrls.current.clear();
    },
    [],
  );

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: fullWidth
          ? "minmax(0, 1fr)"
          : { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" },
        gap: 1.5,
      }}
    >
      {value.map((entry, index) => (
        <FileUploadField
          key={entry.uid}
          value={entry}
          accept={accept}
          maxSizeBytes={maxSizeBytes}
          selectedText={selectedText}
          disabled={disabled}
          onSelect={(file) => replaceFile(index, file)}
          onRemove={() => removeFile(index)}
          onError={onError}
          previewUrl={entry.previewUrl}
        />
      ))}
      {value.length < maxCount ? (
        <FileUploadField
          accept={accept}
          maxSizeBytes={maxSizeBytes}
          emptyTitle={emptyTitle}
          helpText={helpText}
          disabled={disabled}
          onSelect={addFile}
          onError={onError}
          showRemove={false}
        />
      ) : null}
    </Box>
  );
}
