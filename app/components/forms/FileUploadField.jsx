"use client";

import { useState } from "react";
import { Button, Upload } from "antd";
import {
  DeleteOutlined,
  EyeOutlined,
  FileExcelOutlined,
  FileImageOutlined,
  FileOutlined,
  FilePdfOutlined,
  InboxOutlined,
  LoadingOutlined,
} from "@ant-design/icons";
import { Box, useTheme } from "@mui/material";
import FontStyle from "@/app/components/font-style/FontStyle";
import ImagePreviewModal from "@/app/components/modals/ImagePreviewModal";

/** Menampilkan ukuran file terpilih dengan satuan yang mudah dipindai pengguna. */
function formatFileSize(bytes) {
  if (!Number.isFinite(Number(bytes)) || Number(bytes) <= 0) return "Ukuran tidak diketahui";
  if (Number(bytes) < 1024 * 1024) return `${Math.max(1, Math.round(Number(bytes) / 1024))} KB`;
  return `${(Number(bytes) / (1024 * 1024)).toFixed(1)} MB`;
}

/** Memilih ikon berdasarkan MIME tanpa menjadikan ekstensi sebagai validasi keamanan. */
function resolveFileIcon(mimeType, color) {
  const style = { fontSize: 34, color };
  if (mimeType === "application/pdf") return <FilePdfOutlined aria-hidden="true" style={style} />;
  if (mimeType?.startsWith("image/")) return <FileImageOutlined aria-hidden="true" style={style} />;
  if (mimeType?.includes("spreadsheet") || mimeType?.includes("excel"))
    return <FileExcelOutlined aria-hidden="true" style={style} />;
  return <FileOutlined aria-hidden="true" style={style} />;
}

/** Memeriksa MIME/ekstensi untuk feedback klien; signature byte tetap diverifikasi server. */
function matchesAcceptedType(file, accept) {
  if (!accept) return true;
  const mimeType = String(file?.type || "").toLowerCase();
  const fileName = String(file?.name || "").toLowerCase();
  return String(accept)
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .some((rule) => {
      if (rule.startsWith(".")) return fileName.endsWith(rule);
      if (rule.endsWith("/*")) return mimeType.startsWith(rule.slice(0, -1));
      return mimeType === rule;
    });
}

/** Dropzone umum untuk pilihan lokal maupun upload privat yang dikendalikan parent. */
export default function FileUploadField({
  value,
  accept,
  maxSizeBytes,
  emptyTitle = "Pilih atau tarik file ke area ini",
  helpText,
  selectedText = "File terpilih dan siap digunakan",
  disabled = false,
  loading = false,
  onSelect,
  onRemove,
  onError,
  previewUrl,
  showRemove = true,
}) {
  const theme = useTheme();
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const name = value?.name || value?.original_name;
  const size = value?.size ?? value?.size_bytes;
  const mimeType = value?.type || value?.mime_type || "";
  const isImage = mimeType.startsWith("image/");

  /** Validasi ukuran memberi feedback cepat; server tetap memeriksa MIME dan batas final. */
  const selectFile = async (file) => {
    if (!matchesAcceptedType(file, accept)) {
      onError?.("Format file tidak sesuai dengan jenis upload yang dipilih.");
      return Upload.LIST_IGNORE;
    }
    if (maxSizeBytes && file.size > maxSizeBytes) {
      onError?.(`Ukuran file maksimal ${formatFileSize(maxSizeBytes)}.`);
      return Upload.LIST_IGNORE;
    }
    await onSelect?.(file);
    return Upload.LIST_IGNORE;
  };

  /** Tombol hapus tidak boleh memicu ulang file picker pada area drag-and-drop. */
  const removeFile = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    await onRemove?.();
  };

  return (
    <>
      <Upload.Dragger
        accept={accept}
        maxCount={1}
        multiple={false}
        showUploadList={false}
        disabled={disabled || loading}
        beforeUpload={selectFile}
        style={{
          borderColor: value ? theme.status.success.border : theme.palette.divider,
          background: value ? theme.status.success.background : theme.palette.background.paper,
        }}
      >
        <Box
          sx={{
            minHeight: { xs: 132, sm: 144 },
            px: 2,
            py: 2,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 0.75,
          }}
        >
          {loading ? (
            <LoadingOutlined
              aria-hidden="true"
              style={{ fontSize: 34, color: theme.palette.primary.main }}
            />
          ) : value && isImage && previewUrl ? (
            <Box
              component="img"
              src={previewUrl}
              alt={`Pratinjau ${name || "gambar terpilih"}`}
              sx={{
                width: { xs: 112, sm: 136 },
                height: { xs: 112, sm: 136 },
                objectFit: "contain",
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1,
                bgcolor: "background.paper",
              }}
            />
          ) : value ? (
            resolveFileIcon(mimeType, theme.status.success.text)
          ) : (
            <InboxOutlined
              aria-hidden="true"
              style={{ fontSize: 36, color: theme.palette.primary.main }}
            />
          )}

          <FontStyle
            fontWeight={value ? 700 : 600}
            sx={{ maxWidth: "100%", overflowWrap: "anywhere", textAlign: "center" }}
          >
            {loading ? "Memproses file..." : name || emptyTitle}
          </FontStyle>

          <FontStyle
            fontSize={12.5}
            sx={{
              color: value ? theme.status.success.text : theme.ui.mutedText,
              textAlign: "center",
              lineHeight: 1.5,
            }}
          >
            {value ? `${formatFileSize(size)} · ${selectedText}` : helpText}
          </FontStyle>

          {value && !loading ? (
            <Box
              sx={{
                mt: 0.5,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexWrap: "wrap",
                gap: 1,
              }}
            >
              {previewUrl ? (
                <Button
                  icon={<EyeOutlined />}
                  href={isImage ? undefined : previewUrl}
                  target={isImage ? undefined : "_blank"}
                  rel={isImage ? undefined : "noopener noreferrer"}
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (isImage) {
                      event.preventDefault();
                      setImagePreviewOpen(true);
                    }
                  }}
                >
                  {isImage ? "Lihat gambar" : "Lihat file"}
                </Button>
              ) : null}
              {showRemove ? (
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={removeFile}
                >
                  Hapus file
                </Button>
              ) : null}
            </Box>
          ) : null}

          {value && !loading ? (
            <FontStyle fontSize={12} sx={{ color: theme.ui.mutedText, textAlign: "center" }}>
              Klik atau tarik file lain ke area ini untuk mengganti file.
            </FontStyle>
          ) : null}
        </Box>
      </Upload.Dragger>
      <ImagePreviewModal
        open={imagePreviewOpen}
        onClose={() => setImagePreviewOpen(false)}
        imageUrl={previewUrl}
        title={name || "Pratinjau gambar"}
        alt={`Pratinjau ${name || "gambar"}`}
      />
    </>
  );
}
