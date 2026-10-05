"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Tooltip } from "antd";
import { CloudDownloadOutlined, DeleteOutlined, EyeOutlined, PlusOutlined, ReloadOutlined, SafetyCertificateOutlined } from "@ant-design/icons";
import { Alert, Box, IconButton, InputAdornment, MenuItem, TextField, Typography, useTheme } from "@mui/material";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";
import PageHeader from "@/app/components/layout/PageHeader";
import DataPanel from "@/app/components/data-display/DataPanel";
import ResponsiveDataView from "@/app/components/data-display/ResponsiveDataView";
import CompactInfoChip from "@/app/components/chips/CompactInfoChip";
import AppModal from "@/app/components/modals/AppModal";
import ConfirmDialog from "@/app/components/actions/ConfirmDialog";
import FileUploadField from "@/app/components/forms/FileUploadField";
import Notification from "@/app/components/Notifications/Notification";
import useAppNotification from "@/app/hooks/useAppNotification";
import AppIcon from "@/app/components/icons/AppIcon";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";
import { normalizeRequestError, readApiResponse } from "@/lib/api/clientError";
import BackupProgressPanel from "@/app/components/system-backup/BackupProgressPanel";

const labels = {
  queued: "Menunggu", copying: "Menyalin data dan file", securing: "Mengamankan paket",
  verifying: "Memeriksa hasil", ready: "Lengkap", ready_with_warnings: "Siap diunduh — perlu tindak lanjut",
  failed: "Gagal", expired: "Masa unduh habis", deleted: "Dihapus",
};
const tones = { queued: "info", copying: "info", securing: "info", verifying: "info",
  ready: "success", ready_with_warnings: "warning", failed: "danger", expired: "neutral", deleted: "neutral" };
const issueLabels = { missing: "File tidak ditemukan", size_mismatch: "Ukuran file berbeda",
  hash_mismatch: "Isi file berbeda" };
const activeStatuses = new Set(["queued", "copying", "securing", "verifying"]);
const phaseLabels = { preparing: "Menyiapkan backup", snapshot: "Menyiapkan file",
  dump: "Mencadangkan database", inspect: "Memeriksa file",
  package: "Mengemas paket", verify: "Memverifikasi paket" };
const statusLabel = (job) => {
  if (activeStatuses.has(job.status)) return phaseLabels[job.progress?.stage] || labels[job.status];
  if (["ready", "ready_with_warnings"].includes(job.status) &&
      Object.values(job.artifacts || {}).some((artifact) => ["pending", "creating"].includes(artifact.status)))
    return "Paket siap, ZIP diproses";
  return labels[job.status] || job.status;
};
/** Ukuran besar diringkas ke GB agar estimasi ruang mudah dibandingkan. */
const formatBytes = (value) => {
  if (value == null) return "Belum tersedia";
  const bytes = Number(value);
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${new Intl.NumberFormat("id-ID").format(bytes)} B`;
  const unit = bytes >= 1024 ** 3 ? "GB" : bytes >= 1024 ** 2 ? "MB" : "KB";
  const divisor = unit === "GB" ? 1024 ** 3 : unit === "MB" ? 1024 ** 2 : 1024;
  return `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(bytes / divisor)} ${unit}`;
};
const formatDate = (value) => value ? new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium", timeStyle: "short",
}).format(new Date(value)) : "Belum tersedia";

/** Memakai endpoint yang sama untuk status awal dan polling, tanpa notifikasi berulang. */
async function fetchBackups(signal, quiet, cursor = null) {
  const query = new URLSearchParams();
  if (quiet || cursor) query.set("estimate", "0");
  if (cursor) query.set("cursor", cursor);
  const response = await fetch(`/api/system/backups${query.size ? `?${query}` : ""}`, { cache: "no-store", signal });
  return (await readApiResponse(response, "Daftar backup belum dapat dimuat."))?.data ||
    { jobs: [], nextCursor: null, estimate: null };
}

/** Halaman Superadmin menyatukan pembuatan, riwayat, unduhan, dan verifikasi lokal. */
export default function SystemBackupsPage() {
  const theme = useTheme();
  const { notification, showNotification, closeNotification } = useAppNotification();
  const { runWithLoadingBackdrop } = useLoadingBackdrop();
  const [jobs, setJobs] = useState([]);
  const [estimate, setEstimate] = useState(null);
  const [historyCursor, setHistoryCursor] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [selected, setSelected] = useState(null);
  const [issues, setIssues] = useState([]);
  const [issueOrganizations, setIssueOrganizations] = useState([]);
  const [issueCursor, setIssueCursor] = useState(null);
  const [issueLoading, setIssueLoading] = useState(false);
  const [issueError, setIssueError] = useState("");
  const [issueOrganization, setIssueOrganization] = useState("");
  const [issuePriority, setIssuePriority] = useState("");
  const [issueType, setIssueType] = useState("");
  const [verifyJob, setVerifyJob] = useState(null);
  const [verifyFile, setVerifyFile] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState("");
  const [retryArtifact, setRetryArtifact] = useState(null);
  const [retryPassword, setRetryPassword] = useState("");
  const [showRetryPassword, setShowRetryPassword] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [deleteJob, setDeleteJob] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const createRequestId = useRef(null);
  const polling = useRef(false);

  const reload = useCallback(async (signal, quiet = false) => {
    if (quiet && polling.current) return;
    if (quiet) polling.current = true;
    if (!quiet) setLoading(true);
    try {
      const data = quiet ? await fetchBackups(signal, true) :
        await runWithLoadingBackdrop(() => fetchBackups(signal, false), { message: "Memuat riwayat backup..." });
      if (!signal?.aborted) {
        setJobs((current) => quiet ? [...data.jobs,
          ...current.filter((job) => !data.jobs.some((fresh) => fresh.id === job.id))] : data.jobs);
        if (!quiet) setHistoryCursor(data.nextCursor);
        if (data.estimate) setEstimate(data.estimate);
        setError("");
      }
    } catch (cause) {
      if (!signal?.aborted && !quiet) setError(normalizeRequestError(cause).message);
    } finally {
      if (quiet) polling.current = false;
      if (!signal?.aborted && !quiet) setLoading(false);
    }
  }, [runWithLoadingBackdrop]);

  const loadMoreHistory = async () => {
    if (!historyCursor || historyLoading) return;
    setHistoryLoading(true);
    try {
      const data = await fetchBackups(undefined, true, historyCursor);
      setJobs((current) => [...current, ...data.jobs.filter((job) => !current.some((item) => item.id === job.id))]);
      setHistoryCursor(data.nextCursor);
    } catch (cause) { showNotification(normalizeRequestError(cause).message, "error"); }
    finally { setHistoryLoading(false); }
  };

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => reload(controller.signal));
    return () => controller.abort();
  }, [reload]);
  const hasActive = jobs.some((job) => activeStatuses.has(job.status) ||
    Object.values(job.artifacts || {}).some((artifact) => ["pending", "creating"].includes(artifact.status)));
  useEffect(() => {
    if (!hasActive) return undefined;
    const timer = setInterval(() => reload(undefined, true), 5000);
    return () => clearInterval(timer);
  }, [hasActive, reload]);
  useEffect(() => {
    if (!selected?.id) return;
    const updated = jobs.find((job) => job.id === selected.id);
    if (updated) queueMicrotask(() => setSelected(updated));
  }, [jobs, selected?.id]);

  const loadIssues = useCallback(async (jobId, cursor = null, signal) => {
    setIssueLoading(true); setIssueError("");
    try {
      const query = new URLSearchParams();
      if (issueOrganization) query.set("organizationId", issueOrganization);
      if (issuePriority) query.set("priority", issuePriority);
      if (issueType) query.set("issueType", issueType);
      if (cursor) query.set("cursor", cursor);
      const fetchIssues = async () => {
        const response = await fetch(`/api/system/backups/${jobId}/issues?${query}`, { cache: "no-store", signal });
        return (await readApiResponse(response, "Temuan backup belum dapat dimuat."))?.data;
      };
      const data = cursor ? await fetchIssues() :
        await runWithLoadingBackdrop(fetchIssues, { message: "Memuat file yang perlu ditindaklanjuti..." });
      if (!signal?.aborted) {
        setIssues((old) => cursor ? [...old, ...data.rows] : data.rows);
        setIssueCursor(data.nextCursor);
        setIssueOrganizations(data.organizations);
      }
    } catch (cause) {
      if (!signal?.aborted) setIssueError(normalizeRequestError(cause).message);
    } finally { if (!signal?.aborted) setIssueLoading(false); }
  }, [issueOrganization, issuePriority, issueType, runWithLoadingBackdrop]);

  useEffect(() => {
    if (!selected?.issue_count) return undefined;
    const controller = new AbortController();
    queueMicrotask(() => { setIssues([]); setIssueCursor(null); loadIssues(selected.id, null, controller.signal); });
    return () => controller.abort();
  }, [selected?.id, selected?.issue_count, loadIssues]);

  const startBackup = async () => {
    if (!password.trim() || password !== confirmation) {
      setFieldErrors({ password: !password.trim() ? "Kata sandi backup wajib diisi." : "",
        confirmPassword: password !== confirmation ? "Konfirmasi tidak sama." : "" });
      showNotification(!password.trim() ? "Isi kata sandi backup." : "Konfirmasi kata sandi tidak sama.", "error");
      return;
    }
    setSubmitting(true);
    try {
      if (!createRequestId.current) createRequestId.current = crypto.randomUUID();
      const result = await runWithLoadingBackdrop(async () => {
        const response = await fetch("/api/system/backups", {
          method: "POST", headers: { "Content-Type": "application/json", "x-request-id": createRequestId.current },
          body: JSON.stringify({ password, confirmPassword: confirmation }),
        });
        return readApiResponse(response, "Backup belum dapat dimulai.");
      }, { message: "Memulai backup seluruh sistem..." });
      setCreateOpen(false);
      setPassword(""); setConfirmation(""); setFieldErrors({});
      setShowPassword(false); setShowConfirmation(false);
      createRequestId.current = null;
      showNotification(result.message, "success");
      if (result.data) setSelected(result.data);
      await reload();
    } catch (cause) {
      const requestError = normalizeRequestError(cause);
      if (requestError.code === "BACKUP_PREVIOUS_FAILED") createRequestId.current = null;
      setFieldErrors(requestError.fieldErrors || {});
      showNotification(requestError.message, "error");
    }
    finally { setSubmitting(false); }
  };

  const closeCreate = () => {
    if (submitting) return;
    setCreateOpen(false);
    setPassword("");
    setConfirmation("");
    setShowPassword(false);
    setShowConfirmation(false);
    setFieldErrors({});
    createRequestId.current = null;
  };

  const verifyDownload = async () => {
    if (!verifyFile || !verifyJob) return;
    setVerifying(true); setVerifyResult("");
    try {
      const correct = await runWithLoadingBackdrop(async () => {
        const hash = sha256.create();
        const reader = verifyFile.stream().getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          hash.update(value);
        }
        return bytesToHex(hash.digest()) === verifyJob.package_sha256;
      }, { message: "Memeriksa file backup..." });
      setVerifyResult(correct
        ? "File unduhan cocok dengan paket di server. Untuk memeriksa isi dan kata sandi, gunakan alat pemeriksa lokal."
        : "File unduhan tidak cocok atau tidak lengkap. Unduh ulang selama masa unduh masih berlaku.");
    } catch (cause) { showNotification(normalizeRequestError(cause).message, "error"); }
    finally { setVerifying(false); }
  };

  const retryZip = async () => {
    if (!retryPassword || !retryArtifact) return;
    setRetrying(true);
    try {
      const result = await runWithLoadingBackdrop(async () => {
        const response = await fetch(`/api/system/backups/${retryArtifact.id}/artifacts/${retryArtifact.kind}/retry`, {
          method: "POST", headers: { "Content-Type": "application/json", "x-request-id": crypto.randomUUID() },
          body: JSON.stringify({ password: retryPassword, confirmPassword: retryPassword }),
        });
        return readApiResponse(response, "ZIP belum dapat dibuat ulang.");
      }, { message: "Memulai pembuatan ulang ZIP..." });
      showNotification(result.message, "success");
      setRetryArtifact(null); setRetryPassword(""); setShowRetryPassword(false);
      await reload();
    } catch (cause) { showNotification(normalizeRequestError(cause).message, "error"); }
    finally { setRetrying(false); }
  };

  /** Penghapusan hanya memutus paket backup; histori pekerjaan dan temuan tetap tersedia. */
  const removeBackup = async () => {
    if (!deleteJob) return;
    setDeleting(true);
    try {
      const response = await runWithLoadingBackdrop(() => fetch(`/api/system/backups/${deleteJob.id}`, {
        method: "DELETE", headers: { "x-request-id": crypto.randomUUID() },
      }), { message: "Menghapus file backup..." });
      const result = await readApiResponse(response, "File backup belum dapat dihapus.");
      showNotification(result.message, "success");
      setJobs((current) => current.map((job) => job.id === result.data.id ? result.data : job));
      setSelected((current) => current?.id === result.data.id ? result.data : current);
      setDeleteJob(null);
    } catch (cause) { showNotification(normalizeRequestError(cause).message, "error"); }
    finally { setDeleting(false); }
  };

  const artifactSummary = (artifact) => {
    if (!artifact) return "Belum tersedia";
    if (artifact.status === "ready") return `${formatBytes(artifact.sizeBytes)} · Siap diunduh`;
    if (["pending", "creating"].includes(artifact.status)) return "Sedang dibuat";
    if (artifact.status === "failed") return artifact.errorMessage || "Gagal dibuat · dapat dicoba lagi";
    return artifact.status === "deleted" ? "Dihapus" : "Masa unduh habis";
  };

  const artifactButtons = (job) => [
    ["database_zip", "Unduh database"], ["uploads_zip", "Unduh semua file"],
  ].map(([kind, label]) => {
    const artifact = job.artifacts?.[kind];
    if (artifact?.status === "ready") return <Button key={kind} icon={<CloudDownloadOutlined />}
      href={`/api/system/backups/${job.id}/artifacts/${kind}/download`}
      style={{ minHeight: 44, display: "inline-flex", alignItems: "center", justifyContent: "center",
        backgroundColor: theme.palette.info.main, borderColor: theme.palette.info.main,
        color: theme.palette.info.contrastText }}>{label}</Button>;
    if (artifact?.status === "failed") return <Button key={kind} icon={<ReloadOutlined />}
      onClick={() => { setRetryArtifact({ id: job.id, kind, label }); setRetryPassword(""); setShowRetryPassword(false); }}
      style={{ minHeight: 44, display: "inline-flex", alignItems: "center", justifyContent: "center",
        backgroundColor: theme.palette.info.main, borderColor: theme.palette.info.main,
        color: theme.palette.info.contrastText }}>
      Coba lagi: {label}</Button>;
    return null;
  });

  const actionButtons = (job, iconOnly = false) => (
    <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center",
      justifyContent: iconOnly ? "center" : "flex-start", gap: 1.5 }}>
      <Tooltip title={iconOnly ? "Lihat detail backup" : ""}>
        <Button icon={<EyeOutlined />} aria-label="Lihat detail backup" onClick={() => setSelected(job)}
          style={{ minHeight: 44, minWidth: 44, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          {iconOnly ? null : "Detail"}
        </Button>
      </Tooltip>
      {["ready", "ready_with_warnings"].includes(job.status) ? <>
        <Tooltip title={iconOnly ? "Unduh paket backup lengkap" : ""}>
          <Button type="primary" icon={<CloudDownloadOutlined />} aria-label="Unduh paket backup lengkap"
            href={`/api/system/backups/${job.id}/download`}
            style={{ minHeight: 44, minWidth: 44, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            {iconOnly ? null : "Unduh paket lengkap"}
          </Button>
        </Tooltip>
        <Tooltip title={iconOnly ? "Verifikasi file unduhan" : ""}>
          <Button icon={<SafetyCertificateOutlined />} aria-label="Verifikasi file unduhan"
            onClick={() => { setVerifyJob(job); setVerifyFile(null); setVerifyResult(""); }}
            style={{ minHeight: 44, minWidth: 44, display: "inline-flex", alignItems: "center", justifyContent: "center",
              backgroundColor: theme.palette.info.main, borderColor: theme.palette.info.main,
              color: theme.palette.info.contrastText }}>
            {iconOnly ? null : "Verifikasi"}
          </Button>
        </Tooltip>
        <Tooltip title={iconOnly ? "Hapus file backup dari server" : ""}>
          <Button danger icon={<DeleteOutlined />} aria-label="Hapus file backup dari server"
            disabled={Object.values(job.artifacts || {}).some((artifact) => ["pending", "creating"].includes(artifact.status))}
            onClick={() => setDeleteJob(job)}
            style={{ minHeight: 44, minWidth: 44, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            {iconOnly ? null : "Hapus backup"}
          </Button>
        </Tooltip>
      </> : null}
    </Box>
  );

  const columns = [
    { title: "Dibuat", dataIndex: "created_at", render: formatDate },
    { title: "Status", dataIndex: "status", render: (_, job) =>
      <CompactInfoChip label={statusLabel(job)} tone={tones[job.status]} /> },
    { title: "Cakupan", render: (_, job) => job.organization_count == null ? "Seluruh organisasi" :
      `${job.organization_count} organisasi · ${job.file_count ?? "…"} file dalam paket` },
    { title: "Perlu tindak lanjut", dataIndex: "issue_count", render: (count) => Number(count || 0) },
    { title: "Ukuran paket", dataIndex: "package_bytes", render: formatBytes },
    { title: "Penyimpanan", render: (_, job) => job.status === "deleted"
      ? `Dihapus ${formatDate(job.deleted_at)}` : job.status === "expired" ? "Masa unduh habis" :
        ["ready", "ready_with_warnings"].includes(job.status) ? "Sampai dihapus" : "Belum tersedia" },
    { title: "Aksi", width: 245, align: "center", render: (_, job) => actionButtons(job, true) },
  ];

  return (
    <Box sx={{ display: "grid", gap: 3, minWidth: 0, pb: 4 }}>
      <PageHeader title="Backup & Restore" description="Cadangkan database dan seluruh file; pemulihan penuh dilakukan melalui alat server."
        action={<Button type="primary" icon={<PlusOutlined />} disabled={hasActive}
          onClick={() => setCreateOpen(true)} style={{ minHeight: 44 }}>
          Buat backup
        </Button>} />

      <Alert severity="info" sx={{ borderRadius: 2, alignItems: "center", "& .MuiAlert-icon": { alignItems: "center" } }}>
        Backup mencakup database serta seluruh isi folder upload: foto, dokumen, histori, draft, dan karantina dari semua organisasi.
        Hasil disimpan di server sampai Superadmin menghapusnya. Unduh juga ke tempat aman di luar server dan simpan kata sandinya sendiri.
        Jika ada catatan file yang tidak sesuai, daftar tindak lanjut tetap tersedia.
      </Alert>
      <Alert severity="warning" sx={{ borderRadius: 2 }}>
        ZIP database dan ZIP semua file adalah unduhan terpisah dari backup yang sama. Buka dengan kata sandi melalui aplikasi ZIP AES-256.
        ZIP semua file berisi satu ZIP lagi agar lokasi file tetap tersembunyi sampai kata sandi dimasukkan.
        Untuk pemulihan seluruh sistem gunakan paket lengkap; jangan memasangkan database dan file dari backup berbeda.
        ZIP semua file juga mencakup karantina; jangan membuka file yang terdeteksi berbahaya.
      </Alert>

      <DataPanel title="Riwayat backup" description="Paket tetap tersedia di server sampai Superadmin menghapusnya. Pantau ruang penyimpanan secara berkala."
        toolbar={<Box sx={{ display: "flex", justifyContent: "flex-end" }}>
          <Button icon={<ReloadOutlined />} onClick={() => reload()} style={{ minHeight: 44,
            display: "inline-flex", alignItems: "center", justifyContent: "center" }}>Muat ulang</Button>
        </Box>}
        contentSx={{ pb: 0 }}>
        <ResponsiveDataView data={jobs} columns={columns} rowKey="id" loading={loading}
          error={error} onRetry={() => reload()} scrollX={1050}
          emptyDescription="Belum ada backup. Tekan Buat backup untuk memulai."
          renderCard={(job) => <Box sx={{ display: "grid", gap: 1.5, minWidth: 0 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}>
              <Typography fontWeight={700}>{formatDate(job.created_at)}</Typography>
              <CompactInfoChip label={statusLabel(job)} tone={tones[job.status]} />
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
              {job.organization_count ?? "Semua"} organisasi · {job.file_count ?? "…"} file dalam paket · {formatBytes(job.package_bytes)}
            </Typography>
            <Typography variant="body2" color="text.secondary">Perlu tindak lanjut: {job.issue_count || 0} file</Typography>
            <Typography variant="body2" color="text.secondary">{job.status === "deleted"
              ? `Dihapus ${formatDate(job.deleted_at)}` : job.status === "expired" ? "Masa unduh habis" :
                ["ready", "ready_with_warnings"].includes(job.status) ? "Disimpan sampai dihapus" : "Belum tersedia"}</Typography>
            {actionButtons(job)}
          </Box>} />
        {historyCursor ? <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
          <Button onClick={loadMoreHistory} loading={historyLoading} style={{ minHeight: 44 }}>Muat riwayat lainnya</Button>
        </Box> : null}
      </DataPanel>

      <AppModal open={createOpen} title="Buat backup seluruh sistem" size="sm"
        description="Perubahan data dijeda sementara saat salinan dibuat."
        onClose={closeCreate}
        disableClose={submitting}
        footer={<><Button onClick={closeCreate} disabled={submitting} style={{ minHeight: 44 }}>Batal</Button>
          <Button type="primary" loading={submitting} onClick={startBackup} style={{ minHeight: 44 }}>Mulai backup</Button></>}>
        <Box sx={{ display: "grid", gap: 2.5, minWidth: 0 }}>
          <Box sx={{ display: "grid", gap: 0.75 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
              <Typography variant="subtitle2" fontWeight={700}>Cakupan backup</Typography>
              <CompactInfoChip label="Seluruh organisasi" tone="info" />
            </Box>
            <Typography variant="body2" color="text.secondary">
              Database, foto, dokumen, histori, draft, dan file karantina disalin dalam satu pekerjaan.
            </Typography>
          </Box>
          {estimate ? <Box sx={{ display: "grid", gap: 1.25, p: 2, minWidth: 0,
            border: "1px solid", borderColor: "divider", borderRadius: 2, bgcolor: "background.default" }}>
            <Typography variant="subtitle2" fontWeight={700}>Perkiraan sebelum mulai</Typography>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 2, flexWrap: "wrap" }}>
              <Typography variant="body2" color="text.secondary">Database</Typography>
              <Typography variant="body2" fontWeight={700}>{formatBytes(estimate.databaseBytes)}</Typography>
            </Box>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 2, flexWrap: "wrap" }}>
              <Typography variant="body2" color="text.secondary">Foto & dokumen ({Number(estimate.fileCount || 0).toLocaleString("id-ID")} file)</Typography>
              <Typography variant="body2" fontWeight={700}>{formatBytes(estimate.fileBytes)}</Typography>
            </Box>
            <Box sx={{ borderTop: "1px solid", borderColor: "divider", pt: 1.25, display: "grid", gap: 0.5 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 2, flexWrap: "wrap" }}>
                <Typography variant="body2" fontWeight={700}>Ruang sementara dibutuhkan</Typography>
                <Typography variant="body2" fontWeight={700} color="primary.main">{formatBytes(estimate.requiredTemporaryBytes)}</Typography>
              </Box>
              <Typography variant="caption" color="text.secondary">Tersedia {formatBytes(estimate.freeBytes)} di server · untuk paket lengkap dan dua ZIP.</Typography>
            </Box>
          </Box> : null}
          <Alert severity="warning" sx={{ borderRadius: 2, "& .MuiAlert-message": { minWidth: 0 } }}>
            Paket berisi data sensitif. Simpan file dan kata sandinya secara terpisah; kata sandi tidak disimpan di server.
          </Alert>
          <Box sx={{ display: "grid", gap: 1.5 }}>
            <Typography variant="subtitle2" fontWeight={700}>Kata sandi paket</Typography>
            <TextField label="Kata sandi backup" type={showPassword ? "text" : "password"} autoComplete="new-password" value={password}
              onChange={(event) => { setPassword(event.target.value); setFieldErrors({}); }}
              error={Boolean(fieldErrors.password)}
              helperText={fieldErrors.password || "Diperlukan saat memeriksa atau memulihkan backup."} fullWidth
              sx={{ "& .MuiFormHelperText-root": { mx: 0, mt: 0.75 } }}
              slotProps={{ htmlInput: { maxLength: 128 }, input: { endAdornment: (
                <InputAdornment position="end"><IconButton edge="end" aria-label={showPassword ? "Sembunyikan kata sandi backup" : "Tampilkan kata sandi backup"}
                  aria-pressed={showPassword} onClick={() => setShowPassword((value) => !value)}
                  onMouseDown={(event) => event.preventDefault()} sx={{ minWidth: 44, minHeight: 44 }}>
                  <AppIcon icon={showPassword ? "solar:eye-linear" : "solar:eye-closed-linear"} fontSize={19} />
                </IconButton></InputAdornment>
              ) } }} />
            <TextField label="Ulangi kata sandi" type={showConfirmation ? "text" : "password"} autoComplete="new-password" value={confirmation}
              onChange={(event) => { setConfirmation(event.target.value); setFieldErrors({}); }}
              error={Boolean(fieldErrors.confirmPassword)} helperText={fieldErrors.confirmPassword} fullWidth
              sx={{ "& .MuiFormHelperText-root": { mx: 0, mt: 0.75 } }}
              slotProps={{ htmlInput: { maxLength: 128 }, input: { endAdornment: (
                <InputAdornment position="end"><IconButton edge="end" aria-label={showConfirmation ? "Sembunyikan ulang kata sandi" : "Tampilkan ulang kata sandi"}
                  aria-pressed={showConfirmation} onClick={() => setShowConfirmation((value) => !value)}
                  onMouseDown={(event) => event.preventDefault()} sx={{ minWidth: 44, minHeight: 44 }}>
                  <AppIcon icon={showConfirmation ? "solar:eye-linear" : "solar:eye-closed-linear"} fontSize={19} />
                </IconButton></InputAdornment>
              ) } }} />
          </Box>
        </Box>
      </AppModal>

      <AppModal open={Boolean(selected)} title="Detail backup" size="lg" onClose={() => setSelected(null)}
        footer={<Button onClick={() => setSelected(null)} style={{ minHeight: 44 }}>Tutup</Button>}>
        {selected ? <Box sx={{ display: "grid", gap: 1.5, overflowWrap: "anywhere" }}>
          <BackupProgressPanel job={selected} />
          {!activeStatuses.has(selected.status) ? <Alert severity="info">Untuk mengambil gambar atau dokumen, unduh ZIP semua file, buka dengan kata sandi, lalu ekstrak uploads.zip di dalamnya.
            Untuk DBeaver, ekstrak ZIP database dan pilih database.dump. Restore penuh memakai paket lengkap di server.</Alert>
            : null}
          {(activeStatuses.has(selected.status) ?
            [["ID pekerjaan", selected.id], ["Diminta", formatDate(selected.created_at)],
              ["Mulai", formatDate(selected.started_at)]] :
            [["ID pekerjaan", selected.id], ["Status", labels[selected.status]], ["Diminta", formatDate(selected.created_at)],
            ["Pemicu", selected.requested_by_name || "Superadmin"],
            ...(selected.status === "deleted" ? [["Dihapus oleh", selected.deleted_by_name || "Superadmin"]] : []),
            ["Mulai", formatDate(selected.started_at)], ["Selesai", formatDate(selected.completed_at)],
            ["Organisasi", selected.organization_count ?? "Belum tersedia"],
            ["File dalam paket", selected.file_count ?? "Belum tersedia"],
            ["File perlu tindak lanjut", selected.issue_count || 0],
            ["Ukuran file", formatBytes(selected.file_bytes)], ["Ukuran paket", formatBytes(selected.package_bytes)],
            ["SHA-256 paket", selected.package_sha256 || "Belum tersedia"],
            ["ZIP database", artifactSummary(selected.artifacts?.database_zip)],
            ["SHA-256 ZIP database", selected.artifacts?.database_zip?.sha256 || "Belum tersedia"],
            ["ZIP semua file", artifactSummary(selected.artifacts?.uploads_zip)],
            ["SHA-256 ZIP semua file", selected.artifacts?.uploads_zip?.sha256 || "Belum tersedia"],
            ["Penyimpanan", selected.status === "deleted" ? `Dihapus ${formatDate(selected.deleted_at)}` :
              selected.status === "expired" ? "Masa unduh habis" :
                ["ready", "ready_with_warnings"].includes(selected.status) ? "Sampai dihapus" : "Belum tersedia"],
            ["Masalah", selected.error_message || "Tidak ada masalah"]]).map(([label, value]) =>
            <Box key={label} sx={{ display: "grid", gridTemplateColumns: "minmax(100px, 34%) minmax(0, 1fr)", gap: 1 }}>
              <Typography variant="body2" color="text.secondary">{label}</Typography>
              <Typography variant="body2" fontWeight={600}>{value}</Typography>
            </Box>)}
          {["ready", "ready_with_warnings"].includes(selected.status) ?
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, pt: 1 }}>
              {artifactButtons(selected)}
            </Box> : null}
          {Number(selected.issue_count) > 0 ? <Box sx={{ display: "grid", gap: 1.5, mt: 2, minWidth: 0 }}>
            <Typography fontWeight={700}>File perlu ditindaklanjuti</Typography>
            <Typography variant="body2" color="text.secondary">
              File yang tersedia tetap dicadangkan. Daftar ini juga ada di dalam paket terenkripsi.
            </Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3,minmax(0,1fr))" }, gap: 1 }}>
              <TextField select size="small" label="Organisasi" value={issueOrganization}
                sx={{ "& .MuiInputBase-root": { minHeight: 44 } }}
                onChange={(event) => setIssueOrganization(event.target.value)}>
                <MenuItem value="">Semua organisasi</MenuItem>
                {issueOrganizations.map((org) => <MenuItem key={org.id} value={org.id}>{org.name}</MenuItem>)}
              </TextField>
              <TextField select size="small" label="Prioritas" value={issuePriority}
                sx={{ "& .MuiInputBase-root": { minHeight: 44 } }}
                onChange={(event) => setIssuePriority(event.target.value)}>
                <MenuItem value="">Semua prioritas</MenuItem>
                <MenuItem value="restore">Perlu dipulihkan</MenuItem>
                <MenuItem value="cleanup_review">Tinjau pembersihan</MenuItem>
              </TextField>
              <TextField select size="small" label="Masalah" value={issueType}
                sx={{ "& .MuiInputBase-root": { minHeight: 44 } }}
                onChange={(event) => setIssueType(event.target.value)}>
                <MenuItem value="">Semua masalah</MenuItem>
                {Object.entries(issueLabels).map(([value, label]) =>
                  <MenuItem key={value} value={value}>{label}</MenuItem>)}
              </TextField>
            </Box>
            {issueError ? <Alert severity="error" action={<Button onClick={() => loadIssues(selected.id)}>Coba lagi</Button>}>
              {issueError}</Alert> : null}
            {issues.map((issue) => <Box key={issue.stored_file_id} sx={{ p: 1.5, border: "1px solid",
              borderColor: "divider", borderRadius: 2, display: "grid", gap: 0.5, minWidth: 0 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                <Typography fontWeight={700}>{issue.file_label}</Typography>
                <CompactInfoChip label={issueLabels[issue.issue_type]} tone="warning" />
              </Box>
              <Typography variant="body2">{issue.organization_name} · {issue.employee_name || "Tidak terkait pegawai"}
                {issue.employee_no_masked ? ` · NIP ${issue.employee_no_masked}` : ""}</Typography>
              <Typography variant="body2" color="text.secondary">ID file {issue.stored_file_id} · {
                issue.priority === "restore" ? "Pulihkan atau unggah ulang file ini." : "Tinjau untuk pembersihan."}</Typography>
              {issue.relationships?.length > 1 ? <Typography variant="caption" color="text.secondary">
                Terkait: {issue.relationships.map((relation) => `${relation.source}${relation.employeeName
                  ? ` (${relation.employeeName}${relation.nipMasked ? ` · NIP ${relation.nipMasked}` : ""})` : ""}`).join(", ")}
              </Typography> : null}
            </Box>)}
            {issueLoading ? <Typography variant="body2" color="text.secondary">Memuat temuan…</Typography> : null}
            {!issueLoading && !issueError && issues.length === 0 ? <Typography variant="body2" color="text.secondary">
              Tidak ada temuan yang cocok dengan filter.</Typography> : null}
            {issueCursor ? <Button onClick={() => loadIssues(selected.id, issueCursor)} loading={issueLoading}
              style={{ minHeight: 44, justifySelf: "start" }}>Muat lainnya</Button> : null}
          </Box> : null}
        </Box> : null}
      </AppModal>

      <AppModal open={Boolean(retryArtifact)} title="Buat ulang ZIP backup" size="sm"
        description={retryArtifact ? `${retryArtifact.label} dibuat ulang dari paket backup yang sama.` : ""}
        disableClose={retrying} onClose={() => { if (!retrying) { setRetryArtifact(null); setRetryPassword(""); setShowRetryPassword(false); } }}
        footer={<><Button disabled={retrying} onClick={() => { setRetryArtifact(null); setRetryPassword(""); setShowRetryPassword(false); }}
          style={{ minHeight: 44 }}>Batal</Button>
          <Button type="primary" loading={retrying} disabled={!retryPassword} onClick={retryZip}
            style={{ minHeight: 44 }}>Buat ulang ZIP</Button></>}>
        <Box sx={{ display: "grid", gap: 2 }}>
          <Alert severity="info">Masukkan kata sandi paket utama. Sistem tidak menyimpan kata sandi Anda.</Alert>
          <TextField label="Kata sandi backup" type={showRetryPassword ? "text" : "password"}
            autoComplete="off" value={retryPassword} onChange={(event) => setRetryPassword(event.target.value)} fullWidth
            slotProps={{ htmlInput: { maxLength: 128 }, input: { endAdornment: <InputAdornment position="end">
              <IconButton edge="end" aria-label={showRetryPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                aria-pressed={showRetryPassword} onClick={() => setShowRetryPassword((value) => !value)}
                sx={{ minWidth: 44, minHeight: 44 }}>
                <AppIcon icon={showRetryPassword ? "solar:eye-linear" : "solar:eye-closed-linear"} fontSize={19} />
              </IconButton></InputAdornment> } }} />
        </Box>
      </AppModal>

      <AppModal open={Boolean(verifyJob)} title="Verifikasi file unduhan" size="sm"
        description="File diproses di browser dan tidak diunggah kembali ke server."
        onClose={() => { if (!verifying) setVerifyJob(null); }} disableClose={verifying}
        footer={<><Button onClick={() => setVerifyJob(null)} disabled={verifying} style={{ minHeight: 44 }}>Tutup</Button>
          <Button type="primary" loading={verifying} disabled={!verifyFile} onClick={verifyDownload}
            style={{ minHeight: 44 }}>Bandingkan file</Button></>}>
        <Box sx={{ display: "grid", gap: 2 }}>
          <FileUploadField value={verifyFile} accept=".sitou-backup" onSelect={setVerifyFile}
            onRemove={() => { setVerifyFile(null); setVerifyResult(""); }}
            onError={(message) => showNotification(message, "error")}
            emptyTitle="Pilih paket backup yang sudah diunduh"
            helpText="Pemeriksaan ini membandingkan file dengan paket asli di server." />
          {verifyResult ? <Alert severity={verifyResult.startsWith("File unduhan cocok") ? "success" : "error"}>{verifyResult}</Alert> : null}
          <Typography variant="body2" color="text.secondary">
            Untuk memeriksa isi dan kata sandi, jalankan alat pemeriksa lokal pada Windows atau Linux sesuai panduan pemulihan.
          </Typography>
        </Box>
      </AppModal>
      <ConfirmDialog open={Boolean(deleteJob)} title="Hapus file backup dari server?"
        message={deleteJob ? `Paket lengkap dan ZIP dari backup ${formatDate(deleteJob.created_at)} akan dihapus permanen dari server (sekitar ${formatBytes(Number(deleteJob.package_bytes || 0) +
          Object.values(deleteJob.artifacts || {}).reduce((total, artifact) => total + Number(artifact.sizeBytes || 0), 0))}).
          Backup ini mencakup seluruh organisasi. Riwayat dan daftar file bermasalah tetap ada, tetapi paket tidak dapat diunduh atau dipulihkan lagi dari server.
          Pastikan Anda sudah menyimpan salinan di tempat lain.` : ""}
        confirmText="Hapus backup" danger loading={deleting} onConfirm={removeBackup}
        onClose={() => { if (!deleting) setDeleteJob(null); }} />
      <Notification {...notification} onClose={closeNotification} />
    </Box>
  );
}
