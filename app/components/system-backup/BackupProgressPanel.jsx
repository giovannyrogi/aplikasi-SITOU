"use client";

import { Box, CircularProgress, LinearProgress, useMediaQuery, useTheme } from "@mui/material";
import { ArchiveRounded, CheckCircleRounded, ContentCopyRounded, DeleteOutlineRounded, ErrorOutlineRounded, HourglassTopRounded, LockRounded, ManageSearchRounded, SettingsBackupRestoreRounded, StorageRounded, TaskAltRounded, WarningAmberRounded } from "@mui/icons-material";
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
  const unavailable = ["deleted", "expired"].includes(job.status);
  const pendingZips = !unavailable && Object.values(job.artifacts || {}).some((item) =>
    ["pending", "creating"].includes(item.status));
  const isSuccessful = ["ready", "ready_with_warnings"].includes(job.status);
  const busy = running || (isSuccessful && pendingZips);
  const stageIcons = { queued: HourglassTopRounded, preparing: SettingsBackupRestoreRounded,
    snapshot: ContentCopyRounded, dump: StorageRounded, inspect: ManageSearchRounded,
    package: LockRounded, verify: TaskAltRounded, complete: ArchiveRounded };
  const StatusIcon = job.status === "deleted" ? DeleteOutlineRounded : job.status === "failed" ? ErrorOutlineRounded : busy ?
    (running ? stageIcons[stage] || SettingsBackupRestoreRounded : ArchiveRounded) :
    job.status === "ready_with_warnings" ? WarningAmberRounded : isSuccessful ? CheckCircleRounded : ArchiveRounded;
  const tone = job.status === "failed" ? "danger" : busy ? "info" :
    job.status === "ready_with_warnings" ? "warning" : isSuccessful ? "success" : "neutral";
  const currentPercent = running ? progress.percent : null;
  const needsAttention = running && progress.needsAttention;

  return <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, minWidth: 0,
    bgcolor: "background.default", p: { xs: 2, sm: 2.5 }, display: "grid", gap: 2 }}
    role="group" aria-label="Progres backup">
    <Box sx={{ position: "relative", width: 88, height: 88, mx: "auto", display: "grid", placeItems: "center" }}>
      {busy ? <CircularProgress aria-hidden="true" size={86} thickness={2.5}
        sx={{ position: "absolute", color: theme.status[tone].main,
          ...(reducedMotion ? { animation: "none" } : {}) }} /> :
        <Box aria-hidden="true" sx={{ position: "absolute", inset: 0, borderRadius: "50%",
          border: "2px solid", borderColor: theme.status[tone].border }} />}
      <Box sx={{ display: "grid", placeItems: "center", width: 68, height: 68,
        borderRadius: "50%", bgcolor: theme.status[tone].background, color: theme.status[tone].main }}>
        <StatusIcon aria-hidden="true" sx={{ fontSize: 36,
          ...(busy && !reducedMotion ? { animation: "backup-icon-pulse 1.6s ease-in-out infinite",
            "@keyframes backup-icon-pulse": { "0%, 100%": { transform: "scale(1)" }, "50%": { transform: "scale(1.12)" } } } : {}) }} />
      </Box>
    </Box>
    <FontStyle component="h3" fontSize={17} fontWeight={700} sx={{ textAlign: "center" }}
      aria-live="polite" aria-atomic="true">
      {job.status === "deleted" ? "File backup telah dihapus" : job.status === "expired" ? "Masa unduh backup telah berakhir" : job.status === "failed" ? "Backup gagal" : job.status === "ready_with_warnings" ?
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
              job.status === "expired" ? "File backup tidak lagi tersedia untuk diunduh; riwayat tetap tersimpan." :
              "Paket utama dan ZIP tersedia selama belum dihapus."}
    </FontStyle>
    {running ? <>
      <LinearProgress variant={currentPercent == null ? "indeterminate" : "determinate"}
        color="info"
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
      const status = job.status === "deleted" ? "deleted" : job.status === "expired" ? "expired" : artifact.status;
      const percent = artifact.status === "ready" ? 100 :
        artifact.status === "creating" ? stagePercent(artifact.progressDone, artifact.progressTotal) : null;
      return <Box key={kind} sx={{ display: "grid", gap: 0.5, pt: 1, borderTop: "1px solid", borderColor: "divider" }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}>
          <FontStyle fontSize={12} fontWeight={600}>{name}</FontStyle>
          <FontStyle fontSize={12} sx={{ color: "text.secondary" }}>
            {status === "deleted" ? "Dihapus" : status === "expired" ? "Masa unduh habis" : status === "ready" ? "Siap" : status === "failed" ? "Gagal" :
              status === "creating" ? percent == null ? "Sedang dibuat" : `${percent}%` : status === "pending" ? "Menunggu" : "Belum tersedia"}
          </FontStyle>
        </Box>
        {status === "creating" ? <LinearProgress
          variant={percent == null ? "indeterminate" : "determinate"} value={percent ?? undefined}
          aria-label={`Progres ${name}`} sx={{ height: 5, borderRadius: 3,
            "& .MuiLinearProgress-bar": {
              backgroundColor: theme.action[kind === "database_zip" ? "database" : "files"].main,
              ...(reducedMotion ? { animation: "none" } : {}),
            } }} /> : null}
      </Box>;
    })}
  </Box>;
}
