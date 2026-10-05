"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Tooltip } from "antd";
import { CloudDownloadOutlined, DatabaseOutlined, FolderOpenOutlined, DeleteOutlined, EyeOutlined, PlusOutlined, ReloadOutlined, SafetyCertificateOutlined } from "@ant-design/icons";
import { Alert, Box, IconButton, InputAdornment, MenuItem, TextField } from "@mui/material";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";
import FontStyle from "@/app/components/font-style/FontStyle";
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

const alertTextSx = { borderRadius: 2, alignItems: "flex-start", "& .MuiAlert-message": { minWidth: 0, textAlign: "justify", textAlignLast: "left", overflowWrap: "anywhere", lineHeight: 1.7 } };

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

  const artifactSummary = (artifact, jobStatus) => {
    if (jobStatus === "deleted") return "Dihapus";
    if (jobStatus === "expired") return "Masa unduh habis";
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
    if (artifact?.status === "ready") return <Button key={kind} data-action-tone={kind === "database_zip" ? "database" : "files"} icon={kind === "database_zip" ? <DatabaseOutlined /> : <FolderOpenOutlined />}
      href={`/api/system/backups/${job.id}/artifacts/${kind}/download`}
      style={{ minHeight: 44, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{label}</Button>;
    if (artifact?.status === "failed") return <Button key={kind} data-action-tone={kind === "database_zip" ? "database" : "files"} icon={<ReloadOutlined />}
      onClick={() => { setRetryArtifact({ id: job.id, kind, label }); setRetryPassword(""); setShowRetryPassword(false); }}
      style={{ minHeight: 44, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
      Coba lagi: {label}</Button>;
    return null;
  });

  const actionButtons = (job, iconOnly = false) => (
    <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center",
      justifyContent: "center", width: "100%", gap: 1.5,
      ...(!iconOnly ? { display: "grid", gridTemplateColumns: "minmax(0, 1fr)", "& .ant-btn": { width: "100%" } } : {}) }}>
      <Tooltip title={iconOnly ? "Lihat detail backup" : ""}>
        <Button data-action-tone="detail" icon={<EyeOutlined />} aria-label="Lihat detail backup" onClick={() => setSelected(job)}
          style={{ minHeight: 44, minWidth: 44, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          {iconOnly ? null : "Detail"}
        </Button>
      </Tooltip>
      {["ready", "ready_with_warnings"].includes(job.status) ? <>
        <Tooltip title={iconOnly ? "Unduh paket backup lengkap" : ""}>
          <Button data-action-tone="download" icon={<CloudDownloadOutlined />} aria-label="Unduh paket backup lengkap"
            href={`/api/system/backups/${job.id}/download`}
            style={{ minHeight: 44, minWidth: 44, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            {iconOnly ? null : "Unduh paket lengkap"}
          </Button>
        </Tooltip>
        <Tooltip title={iconOnly ? "Verifikasi file unduhan" : ""}>
          <Button data-action-tone="verify" icon={<SafetyCertificateOutlined />} aria-label="Verifikasi file unduhan"
            onClick={() => { setVerifyJob(job); setVerifyFile(null); setVerifyResult(""); }}
            style={{ minHeight: 44, minWidth: 44, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            {iconOnly ? null : "Verifikasi"}
          </Button>
        </Tooltip>
        <Tooltip title={iconOnly ? "Hapus file backup dari server" : ""}>
          <Button danger data-action-tone="danger" icon={<DeleteOutlined />} aria-label="Hapus file backup dari server"
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
    { title: "Temuan pemeriksaan", dataIndex: "issue_count", render: (count) => Number(count || 0) },
    { title: "Ukuran paket", dataIndex: "package_bytes", render: formatBytes },
    { title: "Penyimpanan", render: (_, job) => job.status === "deleted"
      ? `Dihapus ${formatDate(job.deleted_at)}` : job.status === "expired" ? "Masa unduh habis" :
        ["ready", "ready_with_warnings"].includes(job.status) ? "Tersedia" : "Belum tersedia" },
    { title: <Box sx={{ display: "flex", justifyContent: "center", width: "100%" }}>Aksi</Box>, width: 245, align: "center", className: "backup-actions-cell",
      onHeaderCell: () => ({ className: "backup-actions-cell", style: { textAlign: "center", verticalAlign: "middle" } }),
      onCell: () => ({ style: { textAlign: "center", verticalAlign: "middle" } }), render: (_, job) => actionButtons(job, true) },
  ];

  return (
    <Box sx={{ display: "grid", gap: 3, minWidth: 0, pb: 4 }}>
      <PageHeader title="Backup & Restore" description="Cadangkan database dan seluruh file; pemulihan penuh dilakukan melalui alat server."
        action={<Button type="primary" icon={<PlusOutlined />} disabled={hasActive}
          onClick={() => setCreateOpen(true)} style={{ minHeight: 44 }}>
          Buat backup
        </Button>} />

      <Alert severity="info" sx={alertTextSx}>
        Backup mencakup database serta seluruh isi folder upload: foto, dokumen, histori, draft, dan karantina dari semua organisasi.
        Hasil disimpan di server sampai Superadmin menghapusnya. Unduh juga ke tempat aman di luar server dan simpan kata sandinya sendiri.
        Jika ada catatan file yang tidak sesuai, daftar tindak lanjut tetap tersedia.
      </Alert>
      <Alert severity="warning" sx={alertTextSx}>
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
          tableSx={{ "& .ant-table-wrapper .backup-actions-cell": { textAlign: "center", verticalAlign: "middle" } }}
          emptyDescription="Belum ada backup. Tekan Buat backup untuk memulai."
          renderCard={(job) => <Box sx={{ display: "grid", gap: 3, minWidth: 0 }}>
            <Box sx={{ display: "grid", gap: 1.5 }}>
              <FontStyle fontSize={16} fontWeight={700}>{formatDate(job.created_at)}</FontStyle>
              <Box><CompactInfoChip label={statusLabel(job)} tone={tones[job.status]} /></Box>
            </Box>
            <Box component="dl" sx={{ m: 0, display: "grid", gap: 2, minWidth: 0 }}>
              {[["Cakupan", job.organization_count == null ? "Seluruh organisasi" : job.organization_count + " organisasi"],
                ["File dalam paket", job.file_count == null ? "Belum tersedia" : job.file_count + " file"],
                ["Ukuran paket", formatBytes(job.package_bytes)],
                ["Temuan pemeriksaan", (job.issue_count || 0) + " file"],
                ["Penyimpanan", job.status === "deleted" ? "Dihapus " + formatDate(job.deleted_at) : job.status === "expired" ? "Masa unduh habis" :
                  ["ready", "ready_with_warnings"].includes(job.status) ? "Tersedia" : "Belum tersedia"]].map(([label, value]) =>
                <Box key={label} sx={{ display: "grid", gap: 0.75, minWidth: 0 }}>
                  <FontStyle component="dt" fontSize={12} color="text.secondary">{label}</FontStyle>
                  <FontStyle component="dd" fontSize={14} fontWeight={600} sx={{ m: 0 }}>{value}</FontStyle>
                </Box>)}
            </Box>
            <Box sx={{ pt: 3, borderTop: "1px solid", borderColor: "divider" }}>{actionButtons(job)}</Box>
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
              <FontStyle fontSize={14} variant="subtitle2" fontWeight={700}>Cakupan backup</FontStyle>
              <CompactInfoChip label="Seluruh organisasi" tone="info" />
            </Box>
            <FontStyle fontSize={14} variant="body2" color="text.secondary">
              Database, foto, dokumen, histori, draft, dan file karantina disalin dalam satu pekerjaan.
            </FontStyle>
          </Box>
          {estimate ? <Box sx={{ display: "grid", gap: 1.25, p: 2, minWidth: 0,
            border: "1px solid", borderColor: "divider", borderRadius: 2, bgcolor: "background.default" }}>
            <FontStyle fontSize={14} variant="subtitle2" fontWeight={700}>Perkiraan sebelum mulai</FontStyle>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 2, flexWrap: "wrap" }}>
              <FontStyle fontSize={14} variant="body2" color="text.secondary">Database</FontStyle>
              <FontStyle fontSize={14} variant="body2" fontWeight={700}>{formatBytes(estimate.databaseBytes)}</FontStyle>
            </Box>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 2, flexWrap: "wrap" }}>
              <FontStyle fontSize={14} variant="body2" color="text.secondary">Foto & dokumen ({Number(estimate.fileCount || 0).toLocaleString("id-ID")} file)</FontStyle>
              <FontStyle fontSize={14} variant="body2" fontWeight={700}>{formatBytes(estimate.fileBytes)}</FontStyle>
            </Box>
            <Box sx={{ borderTop: "1px solid", borderColor: "divider", pt: 1.25, display: "grid", gap: 0.5 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 2, flexWrap: "wrap" }}>
                <FontStyle fontSize={14} variant="body2" fontWeight={700}>Ruang sementara dibutuhkan</FontStyle>
                <FontStyle fontSize={14} variant="body2" fontWeight={700} color="primary.main">{formatBytes(estimate.requiredTemporaryBytes)}</FontStyle>
              </Box>
              <FontStyle fontSize={12} variant="caption" color="text.secondary">Tersedia {formatBytes(estimate.freeBytes)} di server · untuk paket lengkap dan dua ZIP.</FontStyle>
            </Box>
          </Box> : null}
          <Alert severity="warning" sx={alertTextSx}>
            Paket berisi data sensitif. Simpan file dan kata sandinya secara terpisah; kata sandi tidak disimpan di server.
          </Alert>
          <Box sx={{ display: "grid", gap: 2 }}>
            <FontStyle fontSize={14} variant="subtitle2" fontWeight={700}>Kata sandi paket</FontStyle>
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
        {selected ? <Box sx={{ display: "grid", gap: 3, overflowWrap: "anywhere", minWidth: 0 }}>
          <BackupProgressPanel job={selected} />
          {["ready", "ready_with_warnings"].includes(selected.status) ? <Alert severity="info" sx={alertTextSx}>Untuk mengambil gambar atau dokumen, unduh ZIP semua file, buka dengan kata sandi, lalu ekstrak uploads.zip di dalamnya.
            Untuk DBeaver, ekstrak ZIP database dan pilih database.dump. Restore penuh memakai paket lengkap di server.</Alert>
            : null}
          <Box sx={{ display: "grid", gap: 2, minWidth: 0 }}>
          {(activeStatuses.has(selected.status) ?
            [["ID pekerjaan", selected.id], ["Diminta", formatDate(selected.created_at)],
              ["Mulai", formatDate(selected.started_at)]] :
            [["ID pekerjaan", selected.id], ["Status", labels[selected.status]], ["Diminta", formatDate(selected.created_at)],
            ["Pemicu", selected.requested_by_name || "Superadmin"],
            ...(selected.status === "deleted" ? [["Dihapus oleh", selected.deleted_by_name || "Superadmin"]] : []),
            ["Mulai", formatDate(selected.started_at)], ["Selesai", formatDate(selected.completed_at)],
            ["Organisasi", selected.organization_count ?? "Belum tersedia"],
            ["File dalam paket", selected.file_count ?? "Belum tersedia"],
            ["Temuan saat pemeriksaan", selected.issue_count || 0],
            ["Ukuran file", formatBytes(selected.file_bytes)], ["Ukuran paket", formatBytes(selected.package_bytes)],
            ["SHA-256 paket", selected.package_sha256 || "Belum tersedia"],
            ["ZIP database", artifactSummary(selected.artifacts?.database_zip, selected.status)],
            ["SHA-256 ZIP database", selected.artifacts?.database_zip?.sha256 || "Belum tersedia"],
            ["ZIP semua file", artifactSummary(selected.artifacts?.uploads_zip, selected.status)],
            ["SHA-256 ZIP semua file", selected.artifacts?.uploads_zip?.sha256 || "Belum tersedia"],
            ["Penyimpanan", selected.status === "deleted" ? `Dihapus ${formatDate(selected.deleted_at)}` :
              selected.status === "expired" ? "Masa unduh habis" :
                ["ready", "ready_with_warnings"].includes(selected.status) ? "Tersedia" : "Belum tersedia"],
            ["Masalah", selected.error_message || "Tidak ada masalah"]]).map(([label, value]) =>
            <Box key={label} sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "minmax(100px, 34%) minmax(0, 1fr)" }, gap: { xs: 1, sm: 2 }, minWidth: 0 }}>
              <FontStyle fontSize={14} variant="body2" color="text.secondary">{label}</FontStyle>
              <FontStyle fontSize={14} variant="body2" fontWeight={600}>{value}</FontStyle>
            </Box>)}
          </Box>
          {["ready", "ready_with_warnings"].includes(selected.status) ?
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr)", sm: "repeat(2,minmax(0,1fr))" }, gap: 1.5, pt: 3, borderTop: "1px solid", borderColor: "divider" }}>
              {artifactButtons(selected)}
            </Box> : null}
          {Number(selected.issue_count) > 0 ? <Box sx={{ display: "grid", gap: 3, mt: 0, pt: 3, borderTop: "1px solid", borderColor: "divider", minWidth: 0 }}>
            <FontStyle fontSize={16} fontWeight={700}>{["deleted", "expired"].includes(selected.status) ? "Temuan saat backup dibuat" : "File perlu ditindaklanjuti"}</FontStyle>
            <FontStyle fontSize={14} variant="body2" color="text.secondary">
              {["deleted", "expired"].includes(selected.status) ? "File backup sudah tidak tersedia. Daftar ini disimpan sebagai histori pemeriksaan pada saat backup dibuat, bukan kondisi file saat ini. Periksa Penyimpanan File untuk pengecekan terbaru." : "Daftar ini berisi temuan saat backup dibuat. File yang tersedia tetap dicadangkan, dan daftar temuan disertakan di dalam paket terenkripsi."}
            </FontStyle>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3,minmax(0,1fr))" }, gap: 2 }}>
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
            {issues.map((issue) => <Box key={issue.stored_file_id} sx={{ p: 2, border: "1px solid",
              borderColor: "divider", borderRadius: 2, display: "grid", gap: 1.5, minWidth: 0 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                <FontStyle fontSize={16} fontWeight={700}>{issue.file_label}</FontStyle>
                <CompactInfoChip label={issueLabels[issue.issue_type]} tone="warning" />
              </Box>
              <FontStyle fontSize={14} variant="body2">{issue.organization_name} · {issue.employee_name || "Tidak terkait pegawai"}
                {issue.employee_no_masked ? ` · NIP ${issue.employee_no_masked}` : ""}</FontStyle>
              <FontStyle fontSize={14} variant="body2" color="text.secondary">ID file {issue.stored_file_id} · {
                ["deleted", "expired"].includes(selected.status) ? "Temuan historis; periksa kondisi file terbaru di Penyimpanan File." : issue.priority === "restore" ? "Pulihkan atau unggah ulang file ini." : "Tinjau untuk pembersihan."}</FontStyle>
              {issue.relationships?.length > 1 ? <FontStyle fontSize={12} variant="caption" color="text.secondary">
                Terkait: {issue.relationships.map((relation) => `${relation.source}${relation.employeeName
                  ? ` (${relation.employeeName}${relation.nipMasked ? ` · NIP ${relation.nipMasked}` : ""})` : ""}`).join(", ")}
              </FontStyle> : null}
            </Box>)}
            {issueLoading ? <FontStyle fontSize={14} variant="body2" color="text.secondary">Memuat temuan…</FontStyle> : null}
            {!issueLoading && !issueError && issues.length === 0 ? <FontStyle fontSize={14} variant="body2" color="text.secondary">
              Tidak ada temuan yang cocok dengan filter.</FontStyle> : null}
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
          <Alert severity="info" sx={alertTextSx}>Masukkan kata sandi paket utama. Sistem tidak menyimpan kata sandi Anda.</Alert>
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
          <FontStyle fontSize={14} variant="body2" color="text.secondary">
            Untuk memeriksa isi dan kata sandi, jalankan alat pemeriksa lokal pada Windows atau Linux sesuai panduan pemulihan.
          </FontStyle>
        </Box>
      </AppModal>
      <ConfirmDialog open={Boolean(deleteJob)} title="Hapus file backup"
        messageAlign="center"
        illustration={<DeleteOutlined />} heading="Hapus salinan backup dari server?"
        message="Paket lengkap, ZIP database, dan ZIP seluruh file dari backup ini akan dihapus permanen. Pastikan salinan yang diperlukan sudah Anda unduh."
        confirmText="Hapus backup" danger loading={deleting} onConfirm={removeBackup}
        onClose={() => { if (!deleting) setDeleteJob(null); }}>
        {deleteJob ? <Box sx={{ display: "grid", gap: 1.5, minWidth: 0 }}>
          <Box sx={{ p: 2, border: "1px solid", borderColor: "divider", bgcolor: "background.default", borderRadius: 2, display: "grid", gap: 1 }}>
            <FontStyle fontSize={14} fontWeight={600}>Backup {formatDate(deleteJob.created_at)}</FontStyle>
            <FontStyle fontSize={13} color="text.secondary">Ukuran yang dihapus: {formatBytes(Number(deleteJob.package_bytes || 0) +
              Object.values(deleteJob.artifacts || {}).reduce((total, artifact) => total + Number(artifact.sizeBytes || 0), 0))}</FontStyle>
          </Box>
          <Alert severity="info" sx={alertTextSx}>Database aktif dan foto atau dokumen asli tidak dihapus. Riwayat backup, catatan penghapusan, dan temuan pemeriksaan tetap tersimpan.</Alert>
          <Alert severity="warning" sx={alertTextSx}>Setelah dihapus, backup ini tidak dapat diunduh atau digunakan untuk pemulihan dari server.</Alert>
        </Box> : null}
      </ConfirmDialog>
      <Notification {...notification} onClose={closeNotification} />
    </Box>
  );
}
