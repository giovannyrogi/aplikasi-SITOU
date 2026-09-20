"use client";

import { useEffect, useState } from "react";
import { Alert, Button, Skeleton } from "antd";
import { DownloadOutlined, SafetyCertificateOutlined } from "@ant-design/icons";
import { Box, Divider, useTheme } from "@mui/material";
import AppModal from "@/app/components/modals/AppModal";
import CompactInfoChip from "@/app/components/chips/CompactInfoChip";
import FontStyle from "@/app/components/font-style/FontStyle";
import { readApiResponse, normalizeRequestError } from "@/lib/api/clientError";
import { ACTION_STATUS, SEVERITY } from "@/app/components/discipline/disciplineLabels";
import { formatDisciplinaryValidityPeriod } from "@/lib/discipline/presentation.mjs";
import { reportDate } from "./ReportEmployeeFields";

function Value({ label, children }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <FontStyle fontSize={11.5} sx={{ color: "text.secondary" }}>
        {label}
      </FontStyle>
      <FontStyle fontSize={12.5} fontWeight={600} sx={{ mt: 0.35, overflowWrap: "anywhere" }}>
        {children || "Belum tersedia"}
      </FontStyle>
    </Box>
  );
}

/** Histori resmi dimuat saat modal dibuka agar daftar utama tetap ringan. */
export default function DisciplinaryHistoryModal({
  open,
  employee,
  organizationId,
  onClose,
  onOpenEmployee,
}) {
  const theme = useTheme();
  const [state, setState] = useState({ loading: false, data: [], error: "" });
  const latestActionId = state.data
    .flatMap((disciplineCase) => disciplineCase.actions || [])
    .sort(
      (left, right) =>
        String(right.issued_date).localeCompare(String(left.issued_date)) || Number(right.id) - Number(left.id),
    )[0]?.id;

  useEffect(() => {
    if (!open || !employee?.employee_id || !organizationId) return;
    const controller = new AbortController();
    Promise.resolve().then(() => setState({ loading: true, data: [], error: "" }));
    const query = new URLSearchParams({
      organizationId: String(organizationId),
      officialOnly: "1",
    });
    fetch(`/api/employees/${employee.employee_id}/discipline-history?${query}`, {
      signal: controller.signal,
    })
      .then(readApiResponse)
      .then((body) => setState({ loading: false, data: body.data || [], error: "" }))
      .catch((error) => {
        if (error.name !== "AbortError")
          setState({ loading: false, data: [], error: normalizeRequestError(error).message });
      });
    return () => controller.abort();
  }, [open, employee?.employee_id, organizationId]);

  return (
    <AppModal
      open={open}
      title={`Histori sanksi ${employee?.full_name || "pegawai"}`}
      description={`${employee?.employee_no || "NIP belum tersedia"} · hanya tindakan resmi yang ditampilkan.`}
      icon={<SafetyCertificateOutlined />}
      size="lg"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Tutup</Button>
          <Button type="primary" onClick={() => onOpenEmployee?.(employee)}>
            Buka detail pegawai
          </Button>
        </>
      }
    >
      {state.loading ? (
        <Box sx={{ display: "grid", gap: 2 }} aria-label="Memuat histori sanksi">
          {[1, 2].map((item) => (
            <Skeleton key={item} active paragraph={{ rows: 4 }} />
          ))}
        </Box>
      ) : state.error ? (
        <Alert type="error" title={state.error} showIcon />
      ) : state.data.length === 0 ? (
        <Alert type="info" title="Belum ada tindakan disiplin resmi untuk pegawai ini." showIcon />
      ) : (
        <Box sx={{ display: "grid", gap: 2 }}>
          {state.data.map((disciplineCase) => {
            const action = disciplineCase.actions?.[0];
            if (!action) return null;
            const severity = SEVERITY[disciplineCase.severity] || [
              disciplineCase.severity,
              "neutral",
            ];
            const status = ACTION_STATUS[action.status] || [action.status, "neutral"];
            return (
              <Box
                component="article"
                key={disciplineCase.id}
                sx={{
                  p: { xs: 2, sm: 2.5 },
                  borderRadius: 2,
                  bgcolor: theme.ui.panelSubtleBg,
                  border: `1px solid ${theme.ui.panelBorderSubtle}`,
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 1.5,
                    flexWrap: "wrap",
                  }}
                >
                  <Box>
                    <FontStyle fontSize={14} fontWeight={700}>
                      {disciplineCase.case_no}
                    </FontStyle>
                    <FontStyle fontSize={11.5} sx={{ mt: 0.4, color: "text.secondary" }}>
                      Kejadian {reportDate(disciplineCase.incident_date)}
                    </FontStyle>
                  </Box>
                  <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
                    <CompactInfoChip label={severity[0]} tone={severity[1]} />
                    <CompactInfoChip
                      label={action.action_name_snapshot}
                      tone="danger"
                    />
                    {String(action.id) === String(latestActionId) ? (
                      <CompactInfoChip label={status[0]} tone={status[1]} />
                    ) : null}
                  </Box>
                </Box>
                <Divider sx={{ my: 2 }} />
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", sm: "repeat(2,minmax(0,1fr))" },
                    gap: 1.75,
                  }}
                >
                  <Value label="Nomor surat">
                    {action.letter_no ||
                      (!action.requires_document_snapshot ? "Tidak diperlukan" : "Belum tersedia")}
                  </Value>
                  <Value label="Diterbitkan oleh">{action.issued_by_name}</Value>
                  <Value label="Tanggal terbit">{reportDate(action.issued_date)}</Value>
                  <Value label="Masa berlaku">
                    {formatDisciplinaryValidityPeriod(
                      action.effective_from,
                      action.effective_until,
                      reportDate,
                    )}
                  </Value>
                </Box>
                <Box sx={{ mt: 2, display: "grid", gap: 1.5 }}>
                  <Value label="Uraian kejadian">{disciplineCase.description}</Value>
                  <Value label="Penjelasan pegawai">
                    {disciplineCase.employee_explanation || "Belum dicatat"}
                  </Value>
                  {action.direct_escalation ? (
                    <Value label="Alasan eskalasi langsung">{action.escalation_reason}</Value>
                  ) : null}
                  {action.status === "revoked" ? (
                    <Value
                      label={`Dicabut ${action.revoked_at ? new Date(action.revoked_at).toLocaleString("id-ID") : ""} oleh ${action.revoked_by_name || "petugas berwenang"}`}
                    >
                      {action.revocation_reason}
                    </Value>
                  ) : null}
                </Box>
                {action.document_file_id ? (
                  <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end" }}>
                    <Button
                      icon={<DownloadOutlined />}
                      href={`/api/uploads/${action.document_file_id}?organizationId=${organizationId}&download=1`}
                    >
                      Unduh surat
                    </Button>
                  </Box>
                ) : null}
              </Box>
            );
          })}
        </Box>
      )}
    </AppModal>
  );
}
