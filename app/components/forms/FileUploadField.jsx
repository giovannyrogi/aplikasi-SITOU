"use client";

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
  const name = value?.name || value?.original_name;
  const size = value?.size ?? value?.size_bytes;
  const mimeType = value?.type || value?.mime_type || "";

  /** Validasi ukuran memberi feedback cepat; server tetap memeriksa MIME dan batas final. */
  const selectFile = async (file) => {
    if (maxSizeBytes && file.size > maxSizeBytes) {
      onError?.(`Ukuran file maksimal ${formatFileSize(maxSizeBytes)}.`);
      return Upload.LIST_IGNORE;
    }
    await onSelect?.(file);
    return Upload.LIST_IGNORE;
  };

  /** Tombol hapus tidak boleh memicu ulang file picker pada area drag-and-drop. */
  const removeFile = async (event) => {
    event.stopPropagation();
    await onRemove?.();
  };

  return (
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
                href={previewUrl}
                target="_blank"
                onClick={(event) => event.stopPropagation()}
              >
                Lihat file
              </Button>
            ) : null}
            {showRemove ? (
              <Button danger icon={<DeleteOutlined />} onClick={removeFile}>
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
  );
}
