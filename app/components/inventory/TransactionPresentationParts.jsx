"use client";
import {Button} from "antd";
import {Box} from "@mui/material";
import AppIcon from "@/app/components/icons/AppIcon";
import AppIconTile from "@/app/components/icons/AppIconTile";
import FontStyle from "@/app/components/font-style/FontStyle";
import {transactionPresentations as presentations} from "./transactionPresentations";
/** Identitas jenis yang sama digunakan pada daftar dan modal transaksi. */
export function KindMark({ kind, compact = false, tone }) {
  const entry = presentations[kind] || presentations.receipt;
  const size = compact ? 28 : 40;
  return <AppIconTile icon={entry.icon} tone={tone || entry.tone} size={size}
    iconSize={compact ? 16 : 21} borderRadius={compact ? 1.25 : 2} showBorder/>;
}

/** Gambar dan PDF tetap memakai endpoint privat serta viewer yang sudah tersedia. */
export function TransactionAttachments({ files, organizationId, theme, onPreview }) {
  const labels = {
    purchase_proof: "Bukti pembelian",
    request_document: "Dokumen permintaan",
    handover_photo: "Foto serah terima",
  };
  const images = files.filter((file) => file.mimeType?.startsWith("image/"));
  const documents = files.filter((file) => !file.mimeType?.startsWith("image/"));
  const urlFor = (file) => `/api/uploads/${file.id}?organizationId=${encodeURIComponent(organizationId)}`;
  return <Box sx={{ display: "grid", gap: 2.5 }}>
    <FontStyle fontSize={14} fontWeight={700}>Lampiran</FontStyle>
    {documents.length ? <Box sx={{ display: "grid", gap: 1.5 }}>
      {documents.map((file) => <Box key={file.id} sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, flexWrap: "wrap", p: 2, border: `1px solid ${theme.ui.panelBorder}`, borderRadius: 2, bgcolor: theme.ui.panelSubtleBg }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0, flex: "1 1 200px" }}><AppIconTile icon="solar:document-text-bold-duotone" tone="info" size={48} iconSize={25}/><Box sx={{ minWidth: 0 }}><FontStyle fontSize={12.5} fontWeight={700}>{labels[file.purpose] || "Dokumen transaksi"}</FontStyle><FontStyle fontSize={11.5} sx={{ color: "text.secondary", overflowWrap: "anywhere" }}>{file.name} · PDF privat</FontStyle></Box></Box>
        <Button href={urlFor(file)} target="_blank" rel="noopener noreferrer" icon={<AppIcon icon="solar:eye-linear" width={17}/>} aria-label={`Buka ${file.name}`} style={{ minHeight: 44 }}>Buka PDF</Button>
      </Box>)}
    </Box> : null}
    {images.length ? <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr)", sm: images.length===1 ? "minmax(0,1fr)" : "repeat(2,minmax(0,1fr))" }, gap: 2.5 }}>
      {images.map((file) => { const label = labels[file.purpose] || "Gambar transaksi"; const url = urlFor(file); return <Box key={file.id} sx={{ minWidth: 0 }}>
        <FontStyle fontSize={12.5} fontWeight={700} sx={{ mb: 1 }}>{label}</FontStyle>
        <Box component="button" type="button" onClick={() => onPreview({ url, name: label })} aria-label={`Perbesar ${label.toLowerCase()}`} sx={{ display: "block", width: "100%", aspectRatio: "4 / 3", maxHeight: 260, p: 0, overflow: "hidden", cursor: "zoom-in", bgcolor: theme.ui.panelSubtleBg, border: `1px solid ${theme.ui.panelBorder}`, borderRadius: 2, "&:hover": { borderColor: theme.palette.primary.main }, "&:focus-visible": { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 3 } }}>
          <Box component="img" src={url} alt={label} sx={{ display: "block", width: "100%", height: "100%", objectFit: "contain" }}/>
        </Box>
        <FontStyle fontSize={11.5} sx={{ mt: 1, color: "text.secondary", textAlign: "center", overflowWrap: "anywhere" }}>Klik gambar untuk memperbesar</FontStyle>
      </Box>; })}
    </Box> : null}
  </Box>;
}

