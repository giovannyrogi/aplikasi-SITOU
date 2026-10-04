"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "antd";
import { CloudDownloadOutlined, EyeOutlined, PlusOutlined, ReloadOutlined, SafetyCertificateOutlined } from "@ant-design/icons";
import { Alert, Box, IconButton, InputAdornment, TextField, Typography, useTheme } from "@mui/material";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";
import PageHeader from "@/app/components/layout/PageHeader";
import DataPanel from "@/app/components/data-display/DataPanel";
import ResponsiveDataView from "@/app/components/data-display/ResponsiveDataView";
import CompactInfoChip from "@/app/components/chips/CompactInfoChip";
import AppModal from "@/app/components/modals/AppModal";
import FileUploadField from "@/app/components/forms/FileUploadField";
import Notification from "@/app/components/Notifications/Notification";
import useAppNotification from "@/app/hooks/useAppNotification";
import AppIcon from "@/app/components/icons/AppIcon";
import { normalizeRequestError, readApiResponse } from "@/lib/api/clientError";

const labels = {
  queued: "Menunggu", copying: "Menyalin data dan file", securing: "Mengamankan paket",
  verifying: "Memeriksa hasil", ready: "Siap diunduh", failed: "Gagal", expired: "Masa unduh habis",
};
const tones = { queued: "info", copying: "info", securing: "info", verifying: "info",
  ready: "success", failed: "danger", expired: "neutral" };
const activeStatuses = new Set(["queued", "copying", "securing", "verifying"]);
const formatBytes = (value) => value == null ? "Belum tersedia" :
  value < 1024 * 1024 ? `${(Number(value) / 1024).toFixed(1)} KB` :
    `${(Number(value) / (1024 * 1024)).toFixed(1)} MB`;
const formatDate = (value) => value ? new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium", timeStyle: "short",
}).format(new Date(value)) : "Belum tersedia";

/** Memakai endpoint yang sama untuk status awal dan polling, tanpa notifikasi berulang. */
async function fetchBackups(signal, quiet) {
  const response = await fetch(`/api/system/backups${quiet ? "?estimate=0" : ""}`, { cache: "no-store", signal });
  return (await readApiResponse(response, "Daftar backup belum dapat dimuat."))?.data || { jobs: [], estimate: null };
}

/** Halaman Superadmin menyatukan pembuatan, riwayat, unduhan, dan verifikasi lokal. */
export default function SystemBackupsPage() {
  const theme = useTheme();
  const { notification, showNotification, closeNotification } = useAppNotification();
  const [jobs, setJobs] = useState([]);
  const [estimate, setEstimate] = useState(null);
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
  const [verifyJob, setVerifyJob] = useState(null);
  const [verifyFile, setVerifyFile] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState("");
  const createRequestId = useRef(null);

  const reload = useCallback(async (signal, quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const data = await fetchBackups(signal, quiet);
      if (!signal?.aborted) { setJobs(data.jobs); if (data.estimate) setEstimate(data.estimate); setError(""); }
    } catch (cause) {
      if (!signal?.aborted && !quiet) setError(normalizeRequestError(cause).message);
    } finally { if (!signal?.aborted && !quiet) setLoading(false); }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => reload(controller.signal));
    return () => controller.abort();
  }, [reload]);
  const hasActive = jobs.some((job) => activeStatuses.has(job.status));
  useEffect(() => {
    if (!hasActive) return undefined;
    const timer = setInterval(() => reload(undefined, true), 5000);
    return () => clearInterval(timer);
  }, [hasActive, reload]);

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
      const response = await fetch("/api/system/backups", {
        method: "POST", headers: { "Content-Type": "application/json", "x-request-id": createRequestId.current },
        body: JSON.stringify({ password, confirmPassword: confirmation }),
      });
      const result = await readApiResponse(response, "Backup belum dapat dimulai.");
      setCreateOpen(false);
      setPassword(""); setConfirmation(""); setFieldErrors({});
      setShowPassword(false); setShowConfirmation(false);
      createRequestId.current = null;
      showNotification(result.message, "success");
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
      const hash = sha256.create();
      const reader = verifyFile.stream().getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        hash.update(value);
      }
      const correct = bytesToHex(hash.digest()) === verifyJob.package_sha256;
      setVerifyResult(correct
        ? "File unduhan cocok dengan paket di server. Untuk memeriksa isi dan kata sandi, gunakan alat pemeriksa lokal."
        : "File unduhan tidak cocok atau tidak lengkap. Unduh ulang selama masa unduh masih berlaku.");
    } catch (cause) { showNotification(normalizeRequestError(cause).message, "error"); }
    finally { setVerifying(false); }
  };

  const actionButtons = (job) => (
    <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 }}>
      <Button icon={<EyeOutlined />} aria-label={`Detail backup ${job.id}`} onClick={() => setSelected(job)}
        style={{ minHeight: 44, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
        Detail
      </Button>
      {job.status === "ready" ? <>
        <Button type="primary" icon={<CloudDownloadOutlined />} href={`/api/system/backups/${job.id}/download`}
          style={{ minHeight: 44, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          Unduh
        </Button>
        <Button icon={<SafetyCertificateOutlined />} onClick={() => { setVerifyJob(job); setVerifyFile(null); setVerifyResult(""); }}
          style={{ minHeight: 44, display: "inline-flex", alignItems: "center", justifyContent: "center",
            backgroundColor: theme.palette.info.main, borderColor: theme.palette.info.main,
            color: theme.palette.info.contrastText }}>
          Verifikasi
        </Button>
      </> : null}
    </Box>
  );

  const columns = [
    { title: "Dibuat", dataIndex: "created_at", render: formatDate },
    { title: "Status", dataIndex: "status", render: (status) =>
      <CompactInfoChip label={labels[status] || status} tone={tones[status]} /> },
    { title: "Cakupan", render: (_, job) => job.organization_count == null ? "Seluruh organisasi" :
      `${job.organization_count} organisasi · ${job.file_count ?? "…"} file` },
    { title: "Ukuran paket", dataIndex: "package_bytes", render: formatBytes },
    { title: "Batas unduh", dataIndex: "expires_at", render: formatDate },
    { title: "Aksi", render: (_, job) => actionButtons(job) },
  ];

  return (
    <Box sx={{ display: "grid", gap: 3, minWidth: 0, pb: 4 }}>
      <PageHeader title="Backup Sistem" description="Cadangkan database, foto, dan dokumen seluruh organisasi dalam satu paket terenkripsi."
        action={<Button type="primary" icon={<PlusOutlined />} disabled={hasActive}
          onClick={() => setCreateOpen(true)} style={{ minHeight: 44 }}>
          Buat backup
        </Button>} />

      <Alert severity="info" sx={{ borderRadius: 2, alignItems: "center", "& .MuiAlert-icon": { alignItems: "center" } }}>
        Backup mencakup database serta seluruh isi folder upload: foto, dokumen, histori, draft, dan karantina dari semua organisasi.
        Hasil diunduh ke komputer Anda. Simpan kata sandinya sendiri; server tidak menyimpannya.
      </Alert>

      <DataPanel title="Riwayat backup" description="Paket sementara tersedia untuk diunduh ulang selama 24 jam."
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
              <CompactInfoChip label={labels[job.status] || job.status} tone={tones[job.status]} />
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
              {job.organization_count ?? "Semua"} organisasi · {job.file_count ?? "…"} file · {formatBytes(job.package_bytes)}
            </Typography>
            <Typography variant="body2" color="text.secondary">Batas unduh: {formatDate(job.expires_at)}</Typography>
            {actionButtons(job)}
          </Box>} />
      </DataPanel>

      <AppModal open={createOpen} title="Buat backup seluruh sistem" size="sm"
        description="Sistem akan menjeda perubahan data sebentar selama snapshot dibuat."
        onClose={closeCreate}
        disableClose={submitting}
        footer={<><Button onClick={closeCreate} disabled={submitting} style={{ minHeight: 44 }}>Batal</Button>
          <Button type="primary" loading={submitting} onClick={startBackup} style={{ minHeight: 44 }}>Mulai backup</Button></>}>
        <Box sx={{ display: "grid", gap: 2 }}>
          <Alert severity="warning">Paket berisi data sensitif seluruh organisasi. Simpan di tempat aman dan jangan bagikan kata sandi bersama paket.</Alert>
          {estimate ? <Box sx={{ display: "grid", gap: 0.5, p: 2, border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
            <Typography variant="body2">Database: sekitar {formatBytes(estimate.databaseBytes)}</Typography>
            <Typography variant="body2">Foto dan dokumen: {estimate.fileCount} file · {formatBytes(estimate.fileBytes)}</Typography>
            <Typography variant="body2">Perkiraan ruang sementara: minimal {formatBytes(estimate.databaseBytes + estimate.fileBytes)}.</Typography>
            <Typography variant="body2">Ruang tersedia: {formatBytes(estimate.freeBytes)}</Typography>
          </Box> : null}
          <TextField label="Kata sandi backup" type={showPassword ? "text" : "password"} autoComplete="new-password" value={password}
            onChange={(event) => { setPassword(event.target.value); setFieldErrors({}); }}
            error={Boolean(fieldErrors.password)}
            helperText={fieldErrors.password || "Diperlukan saat memeriksa atau memulihkan backup."} fullWidth
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
            slotProps={{ htmlInput: { maxLength: 128 }, input: { endAdornment: (
              <InputAdornment position="end"><IconButton edge="end" aria-label={showConfirmation ? "Sembunyikan ulang kata sandi" : "Tampilkan ulang kata sandi"}
                aria-pressed={showConfirmation} onClick={() => setShowConfirmation((value) => !value)}
                onMouseDown={(event) => event.preventDefault()} sx={{ minWidth: 44, minHeight: 44 }}>
                <AppIcon icon={showConfirmation ? "solar:eye-linear" : "solar:eye-closed-linear"} fontSize={19} />
              </IconButton></InputAdornment>
            ) } }} />
        </Box>
      </AppModal>

      <AppModal open={Boolean(selected)} title="Detail backup" size="sm" onClose={() => setSelected(null)}
        footer={<Button onClick={() => setSelected(null)} style={{ minHeight: 44 }}>Tutup</Button>}>
        {selected ? <Box sx={{ display: "grid", gap: 1.5, overflowWrap: "anywhere" }}>
          {[["ID pekerjaan", selected.id], ["Status", labels[selected.status]], ["Diminta", formatDate(selected.created_at)],
            ["Pemicu", selected.requested_by_name || "Superadmin"],
            ["Mulai", formatDate(selected.started_at)], ["Selesai", formatDate(selected.completed_at)],
            ["Organisasi", selected.organization_count ?? "Belum tersedia"],
            ["File upload", selected.file_count ?? "Belum tersedia"],
            ["Ukuran file", formatBytes(selected.file_bytes)], ["Ukuran paket", formatBytes(selected.package_bytes)],
            ["SHA-256 paket", selected.package_sha256 || "Belum tersedia"],
            ["Batas unduh", formatDate(selected.expires_at)],
            ["Masalah", selected.error_message || "Tidak ada masalah"]].map(([label, value]) =>
            <Box key={label} sx={{ display: "grid", gridTemplateColumns: "minmax(100px, 34%) minmax(0, 1fr)", gap: 1 }}>
              <Typography variant="body2" color="text.secondary">{label}</Typography>
              <Typography variant="body2" fontWeight={600}>{value}</Typography>
            </Box>)}
        </Box> : null}
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
      <Notification {...notification} onClose={closeNotification} />
    </Box>
  );
}
