"use client";
import { Button, Progress } from "antd";
import { EyeOutlined, ReloadOutlined, FileSearchOutlined, CloseOutlined } from "@ant-design/icons";
import { Box } from "@mui/material";
import FileUploadField from "@/app/components/forms/FileUploadField";
import FontStyle from "@/app/components/font-style/FontStyle";
import AppNotice from "@/app/components/data-display/AppNotice";

export default function HolidayPdfSource({
  importer,
  savedCatalog,
  onSelect,
  onRemove,
  onReview,
  disabled,
}) {
  const { file, job, error, resolved, processing } = importer;
  const stored = savedCatalog?.document;
  const previewUrl = resolved
    ? `/api/system/holiday-catalogs/pdf-imports/${job.id}/document`
    : stored && !file
      ? `/api/holiday-catalogs/${savedCatalog.id}/document`
      : undefined;
  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <FileUploadField
        value={file || (stored ? { ...stored, mime_type: "application/pdf" } : null)}
        accept="application/pdf,.pdf"
        maxSizeBytes={10 * 1024 * 1024}
        emptyTitle="Pilih atau tarik PDF SKB ke sini"
        helpText="PDF maksimal 10 MB dan 20 halaman."
        selectedText={
          processing
            ? "Dokumen sedang diproses"
            : resolved
              ? "Dokumen siap dicocokkan dengan isian"
              : stored && !file
                ? "Dokumen referensi tersimpan"
                : "Dokumen terpilih"
        }
        disabled={disabled || processing}
        loading={importer.busy}
        onSelect={onSelect}
        onRemove={onRemove}
        showRemove={Boolean(file) && !processing}
        onError={importer.setError}
        previewUrl={previewUrl}
      />
      {processing && (
        <Box role="status" aria-live="polite">
          <FontStyle fontSize={14}>
            {job?.status === "queued"
              ? "Menunggu pembacaan dokumen"
              : job?.stage === "reading"
                ? "Membaca halaman"
                : job?.stage === "preparing"
                  ? "Menyiapkan hasil"
                  : "Memeriksa dokumen"}
          </FontStyle>
          <Progress percent={job?.progress || 0} />
          <FontStyle color="text.secondary">
            Anda tetap dapat mengisi tanggal selama dokumen diproses.
          </FontStyle>
        </Box>
      )}
      {processing && !importer.busy && (
        <Button icon={<CloseOutlined />} onClick={onRemove} style={{ justifySelf: "start" }}>
          Batalkan pilihan PDF
        </Button>
      )}
      {error && (
        <AppNotice
          tone="danger"
          title="Dokumen belum siap"
          description={error}
          action={
            <Button
              icon={<ReloadOutlined />}
              disabled={disabled || importer.busy}
              onClick={() => (job ? importer.retry() : importer.upload())}
            >
              Coba lagi
            </Button>
          }
        />
      )}
      {job?.status === "failed" && (
        <AppNotice
          tone="danger"
          title="Dokumen belum dapat dibaca"
          description="Periksa PDF dan layanan pembacaan, lalu unggah ulang. Isian manual tetap tersimpan."
        />
      )}
      {job?.status === "expired" && (
        <AppNotice
          tone="warning"
          title="Unggahan kedaluwarsa"
          description="Unggah kembali dokumen untuk melanjutkan."
        />
      )}
      {resolved && job.result?.yearMismatch && (
        <AppNotice
          tone="danger"
          title="Tahun dokumen berbeda"
          description="Cocokkan tahun katalog dan PDF, lalu unggah ulang dokumen."
        />
      )}
      {(resolved || previewUrl) && (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
          {previewUrl && (
            <Button
              icon={<EyeOutlined />}
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Lihat PDF sumber
            </Button>
          )}
          {resolved && !job.result?.yearMismatch && (
            <Button icon={<FileSearchOutlined />} onClick={onReview} disabled={disabled}>
              Tinjau hasil pembacaan
            </Button>
          )}
        </Box>
      )}
      {resolved && !job.result?.yearMismatch && (
        <FontStyle fontSize={14} color="text.secondary">
          {job.status === "incomplete"
            ? "Pembacaan belum lengkap. Isi dan periksa seluruh tanggal berdasarkan PDF."
            : "Isian manual tetap dipertahankan. Gunakan hasil pembacaan hanya setelah ditinjau."}
        </FontStyle>
      )}
    </Box>
  );
}
