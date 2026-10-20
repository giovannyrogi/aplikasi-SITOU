"use client";

import { useEffect, useId, useState } from "react";
import { Button, Skeleton } from "antd";
import { DownloadOutlined, SafetyCertificateOutlined } from "@ant-design/icons";
import { Accordion, AccordionDetails, AccordionSummary, Box, useTheme } from "@mui/material";
import ExpandMoreRounded from "@mui/icons-material/ExpandMoreRounded";
import AppModal from "@/app/components/modals/AppModal";
import AppNotice from "@/app/components/data-display/AppNotice";
import DataPagination from "@/app/components/data-display/DataPagination";
import CompactInfoChip from "@/app/components/chips/CompactInfoChip";
import FontStyle from "@/app/components/font-style/FontStyle";
import { readApiResponse, normalizeRequestError } from "@/lib/api/clientError";
import { ACTION_STATUS, SEVERITY } from "@/app/components/discipline/disciplineLabels";
import { EMPLOYEE_STATUS_PRESENTATION } from "@/app/components/employees/employeeStatus";
import { formatDisciplinaryValidityPeriod } from "@/lib/discipline/presentation.mjs";
import { reportDate } from "./ReportEmployeeFields";

/** Label dan nilai tetap terbaca untuk teks panjang tanpa menumpuk kartu dekoratif. */
function Value({ label, children }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <FontStyle component="dt" fontSize={12} sx={{ color: "text.secondary" }}>
        {label}
      </FontStyle>
      <FontStyle
        component="dd"
        fontSize={13}
        sx={{ m: 0, mt: 0.5, overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}
      >
        {children || "Belum tersedia"}
      </FontStyle>
    </Box>
  );
}

/** Riwayat resmi dibatasi lima baris per halaman; hanya satu rincian terbuka. */
export default function DisciplinaryHistoryModal({
  open,
  employee,
  organizationId,
  onClose,
  onOpenEmployee,
}) {
  const theme = useTheme();
  const id = useId();
  const [state, setState] = useState({ loading: true, data: [], error: "", key: null });
  const [reload, setReload] = useState(0);
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState(null);
  const requestKey = `${organizationId}:${employee?.employee_id}:${reload}`;
  useEffect(() => {
    if (!open || !employee?.employee_id || !organizationId) return;
    const controller = new AbortController();
    Promise.resolve().then(() => {
      if (!controller.signal.aborted)
        setState({ loading: true, data: [], error: "", key: requestKey });
    });
    const query = new URLSearchParams({
      organizationId: String(organizationId),
      officialOnly: "1",
    });
    fetch(`/api/employees/${employee.employee_id}/discipline-history?${query}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(readApiResponse)
      .then((body) => {
        if (controller.signal.aborted) return;
        setState({ loading: false, data: body.data || [], error: "", key: requestKey });
        setPage(1);
        setExpanded(null);
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState({
            loading: false,
            data: [],
            error: normalizeRequestError(error).message,
            key: requestKey,
          });
      });
    return () => controller.abort();
  }, [open, employee?.employee_id, organizationId, requestKey]);

  // Endpoint lama mengembalikan seluruh histori; pagination presentasi tidak mengubah kontrak API.
  const loading = state.key !== requestKey || state.loading;
  const error = !loading && state.error;
  const entries =
    loading || error
      ? []
      : state.data
          .flatMap((disciplineCase) =>
            (disciplineCase.actions || [])
              .filter((action) => action.status !== "draft")
              .map((action) => ({ disciplineCase, action })),
          )
          .sort(
            (a, b) =>
              String(b.action.issued_date).localeCompare(String(a.action.issued_date)) ||
              (BigInt(b.action.id) > BigInt(a.action.id)
                ? 1
                : BigInt(b.action.id) < BigInt(a.action.id)
                  ? -1
                  : 0),
          );
  const rows = entries.slice((page - 1) * 5, page * 5);
  const employment = EMPLOYEE_STATUS_PRESENTATION[employee?.employment_status];

  return (
    <AppModal
      open={open}
      title="Riwayat sanksi"
      description={`${employee?.full_name || "Pegawai"} · ${employee?.employee_no || "NIP belum tersedia"}`}
      icon={<SafetyCertificateOutlined />}
      size="lg"
      onClose={onClose}
      contentResetKey={`${requestKey}:${page}`}
      pagination={
        !loading && !error && entries.length ? (
          <DataPagination
            pagination={{ page, pageSize: 5, total: entries.length }}
            displayedCount={rows.length}
            pageSizeOptions={[]}
            onPageChange={(value) => {
              setPage(value);
              setExpanded(null);
            }}
            ariaLabel="Navigasi riwayat sanksi"
            sx={{ pt: 0 }}
          />
        ) : null
      }
      footer={
        <>
          <Button onClick={onClose}>Tutup</Button>
          {onOpenEmployee ? (
            <Button type="primary" onClick={() => onOpenEmployee(employee)}>
              Buka detail pegawai
            </Button>
          ) : null}
        </>
      }
    >
      {loading ? (
        <Box aria-label="Memuat riwayat sanksi">
          <Skeleton active paragraph={{ rows: 5 }} />
        </Box>
      ) : error ? (
        <AppNotice
          tone="danger"
          title={error}
          action={
            <Button
              onClick={(event) => {
                // Tombol retry hilang saat loading; fokus tetap pada modal agar Escape bekerja.
                event.currentTarget.closest('[role="dialog"]')?.focus();
                setReload((n) => n + 1);
              }}
            >
              Coba lagi
            </Button>
          }
        />
      ) : !entries.length ? (
        <AppNotice tone="info" title="Belum ada sanksi resmi untuk pegawai ini." />
      ) : (
        <Box sx={{ display: "grid", gap: 2.5 }}>
          <Box
            component="details"
            sx={{ borderBottom: "1px solid", borderColor: "divider", pb: 1.5 }}
          >
            <Box
              component="summary"
              sx={{
                minHeight: 44,
                py: 1,
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 600,
                "&:focus-visible": {
                  outline: "2px solid",
                  outlineColor: "primary.main",
                  outlineOffset: 2,
                },
              }}
            >
              Penempatan dan ringkasan pegawai
            </Box>
            <Box
              component="dl"
              sx={{
                m: 0,
                display: "grid",
                gridTemplateColumns: { xs: "minmax(0,1fr)", sm: "repeat(3,minmax(0,1fr))" },
                gap: 2,
                pt: 1.5,
              }}
            >
              <Value label="Lokasi">{employee?.location_name || "Belum ditempatkan"}</Value>
              <Value label="Divisi & Unit">{employee?.unit_name || "Belum ditentukan"}</Value>
              <Value label="Jabatan">{employee?.position_name || "Belum ditentukan"}</Value>
              <Value label="Status pegawai">
                {employment ? (
                  <CompactInfoChip label={employment[0]} tone={employment[1]} />
                ) : (
                  "Belum tersedia"
                )}
              </Value>
              <Value label="Total sanksi">{`${entries.length} sanksi`}</Value>
            </Box>
          </Box>
          <Box>
            <FontStyle component="h3" fontSize={14} fontWeight={700}>
              Seluruh sanksi resmi
            </FontStyle>
            <FontStyle fontSize={12} sx={{ mt: 0.5, color: "text.secondary" }}>
              Diurutkan dari tanggal terbit terbaru. Pilih sanksi untuk membaca rincian; daftar ini
              tidak dibatasi filter laporan.
            </FontStyle>
          </Box>
          <Box sx={{ display: "grid", gap: 1 }}>
            {rows.map(({ disciplineCase, action }) => {
              const status = ACTION_STATUS[action.status] || [action.status, "neutral"];
              const severity = SEVERITY[disciplineCase.severity] || [
                disciplineCase.severity,
                "neutral",
              ];
              const key = String(action.id);
              return (
                <Accordion
                  key={key}
                  disableGutters
                  slotProps={{ transition: { unmountOnExit: true } }}
                  elevation={0}
                  expanded={expanded === key}
                  onChange={(_, isExpanded) => setExpanded(isExpanded ? key : null)}
                  sx={{
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: "8px !important",
                    overflow: "hidden",
                    "&:before": { display: "none" },
                  }}
                >
                  <AccordionSummary
                    expandIcon={<ExpandMoreRounded />}
                    id={`${id}-${key}-header`}
                    aria-controls={`${id}-${key}-details`}
                    sx={{
                      minHeight: 72,
                      px: 2,
                      "& .MuiAccordionSummary-content": { minWidth: 0, my: 1.5, mr: 1 },
                    }}
                  >
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: { xs: "minmax(0,1fr)", sm: "minmax(0,1fr) auto" },
                        alignItems: "center",
                        width: "100%",
                        gap: 1,
                      }}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <FontStyle fontSize={14} fontWeight={700} sx={{ overflowWrap: "anywhere" }}>
                          {action.action_name_snapshot}
                        </FontStyle>
                        <FontStyle
                          fontSize={12}
                          sx={{ color: "text.secondary", mt: 0.5, overflowWrap: "anywhere" }}
                        >
                          {reportDate(action.issued_date)} · {disciplineCase.case_no}
                        </FontStyle>
                      </Box>
                      <Box sx={{ justifySelf: "start" }}>
                        <CompactInfoChip label={status[0]} tone={status[1]} />
                      </Box>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails
                    id={`${id}-${key}-details`}
                    sx={{
                      p: 2,
                      borderTop: "1px solid",
                      borderColor: "divider",
                      bgcolor: theme.ui.panelSubtleBg,
                    }}
                  >
                    <Box
                      component="dl"
                      sx={{
                        m: 0,
                        display: "grid",
                        gridTemplateColumns: { xs: "minmax(0,1fr)", sm: "repeat(2,minmax(0,1fr))" },
                        gap: 2,
                      }}
                    >
                      <Value label="Tingkat pelanggaran">
                        <CompactInfoChip label={severity[0]} tone={severity[1]} />
                      </Value>
                      <Value label="Tanggal kejadian">
                        {reportDate(disciplineCase.incident_date)}
                      </Value>
                      <Value label="Nomor surat">
                        {action.letter_no ||
                          (!action.requires_document_snapshot
                            ? "Tidak diperlukan"
                            : "Belum tersedia")}
                      </Value>
                      <Value label="Diterbitkan oleh">{action.issued_by_name}</Value>
                      <Value label="Masa berlaku">
                        {formatDisciplinaryValidityPeriod(
                          action.effective_from,
                          action.effective_until,
                          reportDate,
                        )}
                      </Value>
                      <Value label="Tanggal terbit">{reportDate(action.issued_date)}</Value>
                      <Value label="Uraian kejadian">{disciplineCase.description}</Value>
                      <Value label="Penjelasan pegawai">
                        {disciplineCase.employee_explanation || "Belum dicatat"}
                      </Value>
                    </Box>
                    {action.direct_escalation || action.status === "revoked" ? (
                      <Box
                        component="dl"
                        sx={{
                          m: 0,
                          mt: 2,
                          pt: 2,
                          borderTop: "1px solid",
                          borderColor: "divider",
                          display: "grid",
                          gridTemplateColumns: {
                            xs: "minmax(0,1fr)",
                            sm: "repeat(2,minmax(0,1fr))",
                          },
                          gap: 2,
                        }}
                      >
                        {action.direct_escalation ? (
                          <Value label="Alasan pemberian sanksi langsung">
                            {action.escalation_reason}
                          </Value>
                        ) : null}
                        {action.status === "revoked" ? (
                          <>
                            <Value label="Dicabut oleh">
                              {action.revoked_by_name || "Belum tersedia"}
                            </Value>
                            <Value label="Waktu pencabutan">
                              {action.revoked_at
                                ? new Date(action.revoked_at).toLocaleString("id-ID")
                                : "Belum tersedia"}
                            </Value>
                            <Value label="Alasan pencabutan">{action.revocation_reason}</Value>
                          </>
                        ) : null}
                      </Box>
                    ) : null}
                    {action.document_file_id ? (
                      <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end" }}>
                        <Button
                          icon={<DownloadOutlined />}
                          href={`/api/uploads/${action.document_file_id}?organizationId=${organizationId}&download=1`}
                          style={{ minHeight: 44 }}
                        >
                          Unduh surat
                        </Button>
                      </Box>
                    ) : null}
                  </AccordionDetails>
                </Accordion>
              );
            })}
          </Box>
        </Box>
      )}
    </AppModal>
  );
}
