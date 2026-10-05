"use client";

import { Box, CircularProgress, LinearProgress, useMediaQuery, useTheme } from "@mui/material";
import AppLogo from "@/app/components/branding/AppLogo";
import FontStyle from "@/app/components/font-style/FontStyle";
import { stagePercent } from "@/lib/system-backup/progress.mjs";

const stages = {
  queued: "Menunggu proses dimulai", preparing: "Menyiapkan backup",
  snapshot: "Menyiapkan salinan file", dump: "Mencadangkan database",
  inspect: "Memeriksa file", package: "Mengemas dan mengenkripsi",
  verify: "Memverifikasi paket", complete: "Paket utama selesai",
};
const active = new Set(["queued", "copying", "securing", "verifying"]);
const artifactNames = { database_zip: "ZIP database", uploads_zip: "ZIP semua file" };
const number = (value) => new Intl.NumberFormat("id-ID").format(Number(value || 0));
const bytes = (value) => {
  if (!value) return "0 B";
  const unit = value >= 1024 ** 3 ? "GB" : value >= 1024 ** 2 ? "MB" : "KB";
  const base = unit === "GB" ? 1024 ** 3 : unit === "MB" ? 1024 ** 2 : 1024;
  return `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(Number(value) / base)} ${unit}`;
};

export default function BackupProgressPanel({ job }) {
  const theme = useTheme();
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const running = active.has(job.status);
  const progress = job.progress || {};
  const stage = progress.stage || "queued";
  const label = stages[stage] || "Memproses backup";
  const pendingZips = Object.values(job.artifacts || {}).some((item) =>
    ["pending", "creating"].includes(item.status));
  const isSuccessful = ["ready", "ready_with_warnings"].includes(job.status);
  const currentPercent = running ? progress.percent : null;
  const needsAttention = running && progress.needsAttention;

  return <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3,
    bgcolor: "background.default", p: { xs: 2, sm: 2.5 }, display: "grid", gap: 1.25 }}
    role="group" aria-label="Progres backup">
    <Box sx={{ position: "relative", width: 88, height: 88, mx: "auto", display: "grid", placeItems: "center" }}>
      {running || pendingZips ? <CircularProgress aria-hidden="true" size={86} thickness={2.5}
        sx={{ position: "absolute", color: theme.palette.primary.main,
          ...(reducedMotion ? { animation: "none" } : {}) }} /> :
        <Box aria-hidden="true" sx={{ position: "absolute", inset: 0, borderRadius: "50%",
          border: "2px solid", borderColor: isSuccessful ? "success.main" :
            job.status === "failed" ? "error.main" : "divider" }} />}
      <AppLogo variant="mark" alt="" width={50} height={50}
        style={{ width: 50, height: 50, objectFit: "contain" }} />
    </Box>
    <FontStyle component="h3" fontSize={17} fontWeight={700} sx={{ textAlign: "center" }}
      aria-live="polite" aria-atomic="true">
      {job.status === "failed" ? "Backup gagal" : job.status === "ready_with_warnings" ?
        "Paket siap, ada file perlu ditindaklanjuti" : job.status === "ready" ?
          (pendingZips ? "Paket utama siap; ZIP sedang dibuat" : "Backup siap diunduh") : label}
    </FontStyle>
    <FontStyle fontSize={12} sx={{ textAlign: "center", color: "text.secondary" }}>
      {running ? stage === "queued" ? "Sistem sedang memulai proses backup." :
        stage === "snapshot" ? "Sistem menyiapkan salinan tetap sebelum database dicadangkan." :
          stage === "dump" ? "Database sedang dibaca. Waktu proses bergantung pada ukuran data." :
            progress.category ? `${progress.category} sedang diproses.` : "Backup berjalan di server; modal ini boleh ditutup." :
        job.status === "failed" ? job.error_message || "Periksa layanan server lalu coba lagi." :
          pendingZips ? "Paket utama dapat diunduh; tunggu ZIP tambahan selesai." :
            job.status === "deleted" ? "File paket telah dihapus; riwayat tetap tersedia." :
              "Paket utama dan ZIP tersedia selama belum dihapus."}
    </FontStyle>
    {running ? <>
      <LinearProgress variant={currentPercent == null ? "indeterminate" : "determinate"}
        value={currentPercent ?? undefined} aria-label={`Progres tahap ${label}`}
        sx={{ mt: 1, height: 8, borderRadius: 4,
          ...(reducedMotion ? { "& .MuiLinearProgress-bar": { animation: "none" } } : {}) }} />
      <FontStyle fontSize={12} sx={{ color: "text.secondary", textAlign: "center" }}>
        {currentPercent == null ? "Tahap ini belum memiliki persentase yang dapat dihitung." :
          `${currentPercent}% dari tahap ${label.toLowerCase()}`}
        {progress.unit === "bytes" && Number(progress.done) > 0 ? ` · ${bytes(progress.done)} diproses` : ""}
        {progress.unit === "files" && Number(progress.done) > 0 ? ` · ${number(progress.done)} file diproses` : ""}
        {progress.total != null && progress.unit === "files" ? ` dari ${number(progress.total)} file` : ""}
      </FontStyle>
      {needsAttention ? <FontStyle fontSize={12} sx={{ textAlign: "center", color: "warning.main" }}>
        Tahap ini lebih lama dari biasanya. Jika status tidak berubah, periksa layanan backup di server.
      </FontStyle> : null}
    </> : null}
    {Object.entries(artifactNames).map(([kind, name]) => {
      const artifact = job.artifacts?.[kind];
      if (!artifact) return null;
      const percent = artifact.status === "ready" ? 100 :
        artifact.status === "creating" ? stagePercent(artifact.progressDone, artifact.progressTotal) : null;
      return <Box key={kind} sx={{ display: "grid", gap: 0.5, pt: 1, borderTop: "1px solid", borderColor: "divider" }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}>
          <FontStyle fontSize={12} fontWeight={600}>{name}</FontStyle>
          <FontStyle fontSize={12} sx={{ color: "text.secondary" }}>
            {artifact.status === "ready" ? "Siap" : artifact.status === "failed" ? "Gagal" :
              artifact.status === "creating" ? percent == null ? "Sedang dibuat" : `${percent}%` : "Menunggu"}
          </FontStyle>
        </Box>
        {artifact.status === "creating" ? <LinearProgress
          variant={percent == null ? "indeterminate" : "determinate"} value={percent ?? undefined}
          aria-label={`Progres ${name}`} sx={{ height: 5, borderRadius: 3,
            ...(reducedMotion ? { "& .MuiLinearProgress-bar": { animation: "none" } } : {}) }} /> : null}
      </Box>;
    })}
  </Box>;
}
