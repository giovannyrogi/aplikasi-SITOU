"use client";

import { Button } from "antd";
import { DownloadOutlined, FileTextOutlined, SafetyCertificateOutlined } from "@ant-design/icons";
import { Box, Divider, useTheme } from "@mui/material";
import AppModal from "@/app/components/modals/AppModal";
import CompactInfoChip from "@/app/components/chips/CompactInfoChip";
import FontStyle from "@/app/components/font-style/FontStyle";
import { ACTION_LABELS, ACTION_STATUS, CASE_STATUS, SEVERITY } from "./disciplineLabels";

/** Memformat tanggal kalender tanpa pergeseran timezone. */
function formatDate(value, fallback = "Belum ditentukan") {
  if (!value) return fallback;
  const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return String(value);
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

/** Memformat waktu audit sesuai locale perangkat pengguna. */
function formatDateTime(value, fallback = "Belum ditentukan") {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

/** Mengubah ukuran byte menjadi label yang mudah dipahami. */
function formatFileSize(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes < 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Satu pasangan label dan nilai untuk detail kasus yang mudah dipindai. */
function DetailValue({ label, children }) {
  const theme = useTheme();
  return (
    <Box sx={{ minWidth: 0 }}>
      <FontStyle fontSize={11.5} sx={{ color: theme.ui.mutedText }}>
        {label}
      </FontStyle>
      <FontStyle fontSize={12.5} fontWeight={600} sx={{ mt: 0.5, lineHeight: 1.6 }}>
        {children || "Belum ditentukan"}
      </FontStyle>
    </Box>
  );
}

/** Section modal menjaga informasi sensitif terkelompok tanpa nested card. */
function DetailSection({ title, children }) {
  const theme = useTheme();
  return (
    <Box component="section">
      <FontStyle component="h3" fontSize={14} fontWeight={700}>
        {title}
      </FontStyle>
      <Divider sx={{ mt: 1.25, mb: 2, borderColor: theme.ui.panelBorderSubtle }} />
      {children}
    </Box>
  );
}

/** Menampilkan seluruh fakta kasus dan tindakan resmi tanpa memadatkan kartu daftar. */
export default function DisciplineCaseDetailModal({
  open,
  disciplineCase,
  organizationId,
  onClose,
}) {
  const theme = useTheme();
  if (!disciplineCase) return null;

  const action = disciplineCase.actions?.[0] || null;
  const caseStatus = CASE_STATUS[disciplineCase.status] || [disciplineCase.status, "neutral"];
  const severity = SEVERITY[disciplineCase.severity] || [disciplineCase.severity, "neutral"];
  const actionStatus = action ? ACTION_STATUS[action.status] || [action.status, "neutral"] : null;
  const isOralWarning = action?.action_type === "oral_warning";
  const fileDescription = [
    action?.document_original_name,
    formatFileSize(action?.document_size_bytes),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <AppModal
      open={open}
      title="Detail kasus disiplin"
      description={`Informasi lengkap ${disciplineCase.case_no} dan keputusan yang tercatat.`}
      icon={<SafetyCertificateOutlined />}
      size="lg"
      onClose={onClose}
    >
      <Box sx={{ display: "grid", gap: 3 }}>
        <DetailSection title="Informasi kasus">
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 2 }}>
            <CompactInfoChip label={severity[0]} tone={severity[1]} />
            <CompactInfoChip label={caseStatus[0]} tone={caseStatus[1]} />
          </Box>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" },
              gap: 2,
            }}
          >
            <DetailValue label="Nomor kasus">{disciplineCase.case_no}</DetailValue>
            <DetailValue label="Tanggal kejadian">
              {formatDate(disciplineCase.incident_date)}
            </DetailValue>
            <DetailValue label="Dibuka oleh">{disciplineCase.opened_by_name}</DetailValue>
            <DetailValue label="Waktu dibuka">
              {formatDateTime(disciplineCase.opened_at)}
            </DetailValue>
            {disciplineCase.closed_at ? (
              <DetailValue label="Waktu ditutup">
                {formatDateTime(disciplineCase.closed_at)}
              </DetailValue>
            ) : null}
          </Box>
        </DetailSection>

        <DetailSection title="Uraian dan penjelasan pegawai">
          <Box sx={{ display: "grid", gap: 2 }}>
            <DetailValue label="Uraian kejadian">{disciplineCase.description}</DetailValue>
            <DetailValue label="Penjelasan atau pembelaan pegawai">
              {disciplineCase.employee_explanation || "Belum ada penjelasan pegawai yang dicatat."}
            </DetailValue>
          </Box>
        </DetailSection>

        <DetailSection title="Tindakan resmi">
          {action ? (
            <Box sx={{ display: "grid", gap: 2.5 }}>
              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                <CompactInfoChip
                  label={ACTION_LABELS[action.action_type] || action.action_type}
                  tone="danger"
                />
                <CompactInfoChip label={actionStatus[0]} tone={actionStatus[1]} />
              </Box>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "minmax(0, 1fr)",
                    sm: "repeat(2, minmax(0, 1fr))",
                  },
                  gap: 2,
                }}
              >
                <DetailValue label="Nomor surat">
                  {isOralWarning
                    ? "Tidak diperlukan untuk teguran lisan"
                    : action.letter_no || "Belum dicatat"}
                </DetailValue>
                <DetailValue label="Diterbitkan oleh">{action.issued_by_name}</DetailValue>
                <DetailValue label="Tanggal terbit">{formatDate(action.issued_date)}</DetailValue>
                <DetailValue label="Mulai berlaku">{formatDate(action.effective_from)}</DetailValue>
                <DetailValue label="Akhir berlaku">
                  {formatDate(action.effective_until, "Selesai sesuai keputusan")}
                </DetailValue>
                <DetailValue label="Waktu dicatat">{formatDateTime(action.created_at)}</DetailValue>
              </Box>

              {action.direct_escalation ? (
                <Box
                  sx={{
                    p: 2,
                    borderRadius: "8px",
                    bgcolor: theme.status.warning.background,
                    border: `1px solid ${theme.status.warning.border}`,
                  }}
                >
                  <FontStyle fontSize={12.5} fontWeight={700}>
                    Eskalasi langsung
                  </FontStyle>
                  <FontStyle fontSize={12} sx={{ mt: 0.75, lineHeight: 1.65 }}>
                    {action.escalation_reason || "Alasan eskalasi belum dicatat."}
                  </FontStyle>
                </Box>
              ) : null}

              {action.notes ? (
                <DetailValue label="Catatan internal">{action.notes}</DetailValue>
              ) : null}

              {action.status === "revoked" ? (
                <Box
                  sx={{
                    p: 2,
                    borderRadius: "8px",
                    bgcolor: theme.status.warning.background,
                    border: `1px solid ${theme.status.warning.border}`,
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                    <FontStyle fontSize={12.5} fontWeight={700}>
                      Riwayat pencabutan
                    </FontStyle>
                    <CompactInfoChip label="Dicabut" tone="warning" />
                  </Box>
                  <Box
                    sx={{
                      mt: 1.25,
                      display: "grid",
                      gridTemplateColumns: {
                        xs: "minmax(0, 1fr)",
                        sm: "repeat(2, minmax(0, 1fr))",
                      },
                      gap: 1.5,
                    }}
                  >
                    <DetailValue label="Dicabut oleh">
                      {action.revoked_by_name || "Belum diketahui"}
                    </DetailValue>
                    <DetailValue label="Waktu pencabutan">
                      {formatDateTime(action.revoked_at)}
                    </DetailValue>
                  </Box>
                  <FontStyle fontSize={11.5} sx={{ mt: 1.5, color: theme.ui.mutedText }}>
                    Alasan pencabutan
                  </FontStyle>
                  <FontStyle fontSize={12.5} fontWeight={600} sx={{ mt: 0.5, lineHeight: 1.65 }}>
                    {action.revocation_reason || "Alasan pencabutan belum dicatat."}
                  </FontStyle>
                </Box>
              ) : null}

              {action.document_file_id ? (
                <Box
                  sx={{
                    p: 2,
                    display: "flex",
                    alignItems: { xs: "flex-start", sm: "center" },
                    justifyContent: "space-between",
                    flexDirection: { xs: "column", sm: "row" },
                    gap: 1.5,
                    borderRadius: "8px",
                    bgcolor: theme.ui.panelSubtleBg,
                    border: `1px solid ${theme.ui.panelBorderSubtle}`,
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0 }}>
                    <FileTextOutlined style={{ fontSize: 20 }} />
                    <Box sx={{ minWidth: 0 }}>
                      <FontStyle fontSize={12.5} fontWeight={700}>
                        Surat tindakan
                      </FontStyle>
                      <FontStyle
                        fontSize={11.5}
                        sx={{ mt: 0.35, color: theme.ui.mutedText, overflowWrap: "anywhere" }}
                      >
                        {fileDescription || "Dokumen PDF tersimpan secara privat."}
                      </FontStyle>
                    </Box>
                  </Box>
                  <Button
                    icon={<DownloadOutlined />}
                    href={`/api/uploads/${action.document_file_id}?organizationId=${organizationId}&download=1`}
                  >
                    Unduh surat
                  </Button>
                </Box>
              ) : (
                <FontStyle fontSize={12} sx={{ color: theme.ui.mutedText }}>
                  {isOralWarning
                    ? "Teguran lisan tidak memerlukan nomor atau dokumen surat."
                    : "Dokumen surat belum tersedia."}
                </FontStyle>
              )}
            </Box>
          ) : (
            <FontStyle fontSize={12.5} sx={{ color: theme.ui.mutedText }}>
              Belum ada tindakan resmi yang ditetapkan untuk kasus ini.
            </FontStyle>
          )}
        </DetailSection>
      </Box>
    </AppModal>
  );
}
