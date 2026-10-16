"use client";
import { useState } from "react";
import { Button, Skeleton } from "antd";
import { Box, useTheme } from "@mui/material";
import AppModal from "@/app/components/modals/AppModal";
import DataPagination from "@/app/components/data-display/DataPagination";
import ErrorState from "@/app/components/data-display/ErrorState";
import EmptyState from "@/app/components/data-display/EmptyState";
import CompactInfoChip from "@/app/components/chips/CompactInfoChip";
import FontStyle from "@/app/components/font-style/FontStyle";
import useDashboardData from "@/app/components/dashboard/useDashboardData";
import LeaveBalanceFields from "./LeaveBalanceFields";
import { ReportIdentity } from "./ReportEmployeeFields";
import { LEAVE_STATUS, LEAVE_UNIT, formatLeaveDate } from "@/lib/leave/labels.mjs";

const PAGE_SIZE = 5;
const number = (value) => new Intl.NumberFormat("id-ID").format(value);

/** Rincian angka rekap; tidak membuka administrasi atau dokumen privat cuti/izin. */
export default function LeaveSummaryDetailsModal({ row, query, onPreview, onClose }) {
  const theme = useTheme();
  const [history, setHistory] = useState([]),
    [cursor, setCursor] = useState("");
  const input = new URLSearchParams(query);
  input.set("view", "details");
  input.set("employeeId", row.employee_id);
  input.set("leaveTypeId", row.leave_type_id);
  input.set("pageSize", String(PAGE_SIZE));
  if (cursor) input.set("cursor", cursor);
  else input.delete("cursor");
  const state = useDashboardData(`/api/reports/leave-summary?${input}`);
  const data = state.data;
  const metrics = [
    { label: "Disetujui", value: number(row.approved), unit: "cuti/izin" },
    { label: "Durasi cuti/izin", value: number(row.duration), unit: LEAVE_UNIT[row.unit] },
    { label: "Dibatalkan", value: number(row.cancelled), unit: "cuti/izin" },
  ];
  return (
    <AppModal
      open
      title="Rincian rekap cuti & izin"
      description={`${row.leave_type_name} · Tahun ${input.get("year")}`}
      icon="solar:calendar-search-bold-duotone"
      footer={<Button onClick={onClose}>Tutup</Button>}
      size="lg"
      onClose={onClose}
    >
      <Box sx={{ display: "grid", gap: 3, minWidth: 0 }}>
        <Box
          sx={{
            display: "grid",
            gap: 2,
            p: 2,
            border: "1px solid",
            borderColor: theme.ui.panelBorderSubtle,
            borderRadius: 2,
            bgcolor: theme.ui.panelSubtleBg,
          }}
        >
          <ReportIdentity row={row} onPreview={onPreview} />
          <Box>
            <FontStyle fontSize={11} sx={{ color: "text.secondary", mb: 0.5 }}>
              Penempatan saat ini
            </FontStyle>
            <FontStyle fontSize={12} sx={{ overflowWrap: "anywhere" }}>
              {[row.organization_unit_name, row.location_name].filter(Boolean).join(" · ") ||
                "Belum ditempatkan"}
            </FontStyle>
          </Box>
        </Box>
        <Box
          component="section"
          aria-label="Ringkasan rekap"
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "repeat(3,minmax(0,1fr))" },
            gap: 1.5,
          }}
        >
          {metrics.map((metric) => (
            <Box
              key={metric.label}
              sx={{
                p: { xs: 1.5, sm: 2 },
                display: "flex",
                flexDirection: { xs: "row", sm: "column" },
                alignItems: { xs: "center", sm: "flex-start" },
                justifyContent: "space-between",
                gap: 1,
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 2,
                minWidth: 0,
              }}
            >
              <FontStyle fontSize={12} sx={{ color: "text.secondary" }}>
                {metric.label}
              </FontStyle>
              <Box sx={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: 0.75 }}>
                <FontStyle
                  fontSize={22}
                  fontWeight={700}
                  sx={{ fontVariantNumeric: "tabular-nums", overflowWrap: "anywhere" }}
                >
                  {metric.value}
                </FontStyle>
                <FontStyle fontSize={12} sx={{ color: "text.secondary" }}>
                  {metric.unit}
                </FontStyle>
              </Box>
            </Box>
          ))}
        </Box>
        <LeaveBalanceFields row={row} year={input.get("year")} />
        <Box component="section" aria-label="Daftar cuti dan izin" sx={{ minWidth: 0 }}>
          <FontStyle component="h3" fontSize={14} fontWeight={700} sx={{ mb: 0.5 }}>
            Daftar cuti & izin
          </FontStyle>
          <FontStyle fontSize={12} sx={{ color: "text.secondary", mb: 2 }}>
            Cuti/izin yang dibatalkan tidak dihitung dalam jumlah dan durasi disetujui.
          </FontStyle>
          {state.loading ? (
            <Skeleton active paragraph={{ rows: 4 }} />
          ) : state.error ? (
            <ErrorState message={state.error.message} onRetry={state.retry} />
          ) : !data?.rows?.length ? (
            <EmptyState description="Belum ada cuti atau izin pada tahun ini." />
          ) : (
            <Box component="ol" sx={{ listStyle: "none", p: 0, m: 0, display: "grid", gap: 1.5 }}>
              {data.rows.map((item, index) => (
                <Box
                  component="li"
                  key={item.id}
                  sx={{
                    p: 2,
                    border: "1px solid",
                    borderColor: theme.ui.panelBorderSubtle,
                    borderRadius: 2,
                    display: "grid",
                    gap: 1.5,
                    minWidth: 0,
                  }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: 1,
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        gap: 1,
                        minWidth: 0,
                      }}
                    >
                      <FontStyle fontSize={11} sx={{ color: "text.secondary" }}>
                        {history.length * PAGE_SIZE + index + 1}.
                      </FontStyle>
                      <FontStyle fontSize={13} fontWeight={600} sx={{ overflowWrap: "anywhere" }}>
                        {item.request_no}
                      </FontStyle>
                    </Box>
                    <CompactInfoChip
                      label={LEAVE_STATUS[item.status]?.[0]}
                      tone={LEAVE_STATUS[item.status]?.[1]}
                    />
                  </Box>
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: { xs: "minmax(0,1fr)", sm: "minmax(0,1fr) auto" },
                      gap: 2,
                    }}
                  >
                    <Box>
                      <FontStyle fontSize={11} sx={{ color: "text.secondary", mb: 0.5 }}>
                        Periode
                      </FontStyle>
                      <FontStyle fontSize={13} sx={{ overflowWrap: "anywhere" }}>
                        {formatLeaveDate(item.start_date)} – {formatLeaveDate(item.end_date)}
                      </FontStyle>
                    </Box>
                    <Box>
                      <FontStyle fontSize={11} sx={{ color: "text.secondary", mb: 0.5 }}>
                        Durasi cuti/izin
                      </FontStyle>
                      <FontStyle fontSize={14} fontWeight={600}>
                        {number(item.requested_units)} {LEAVE_UNIT[item.unit]}
                      </FontStyle>
                    </Box>
                  </Box>
                </Box>
              ))}
            </Box>
          )}
          <DataPagination
            cursor={{ page: history.length + 1, next: data?.nextCursor }}
            total={data?.total || 0}
            pageSize={PAGE_SIZE}
            pageSizeOptions={[]}
            loading={state.loading || Boolean(state.error)}
            ariaLabel="Navigasi daftar cuti dan izin"
            onNext={() => {
              setHistory([...history, cursor]);
              setCursor(data.nextCursor);
            }}
            onPrevious={() => {
              setCursor(history.at(-1) || "");
              setHistory(history.slice(0, -1));
            }}
          />
        </Box>
      </Box>
    </AppModal>
  );
}
