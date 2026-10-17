"use client";
import { useEffect, useRef, useState } from "react";
import { Box, ButtonBase, Tab, Tabs, useTheme } from "@mui/material";
import dayjs from "dayjs";
import DataPanel from "@/app/components/data-display/DataPanel";
import AppIcon from "@/app/components/icons/AppIcon";
import AppIconTile from "@/app/components/icons/AppIconTile";
import FontStyle from "@/app/components/font-style/FontStyle";
import CompactInfoChip from "@/app/components/chips/CompactInfoChip";
import LeaveDetailModal from "@/app/components/leave/LeaveDetailModal";
import Notification from "@/app/components/Notifications/Notification";
import useAppNotification from "@/app/hooks/useAppNotification";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";
import { readApiResponse, normalizeRequestError } from "@/lib/api/clientError";
import { LEAVE_STATUS, LEAVE_UNIT } from "@/lib/leave/labels.mjs";

/** Ringkasan pribadi; rincian dan lampiran tetap diperiksa server saat dibuka. */
export default function EmployeeLeavePanel({ leave, year }) {
  const theme = useTheme();
  const [tab, setTab] = useState("all");
  const [detail, setDetail] = useState(null);
  const [opening, setOpening] = useState(false);
  const requestRef = useRef(null);
  const { runWithLoadingBackdrop } = useLoadingBackdrop();
  const { notification, showNotification, closeNotification } = useAppNotification();
  useEffect(() => () => requestRef.current?.abort(), []);
  async function openDetail(id) {
    if (requestRef.current) return;
    const request = new AbortController();
    requestRef.current = request;
    setOpening(true);
    try {
      const body = await runWithLoadingBackdrop(
        () =>
          fetch(`/api/dashboard/leave_self/${id}`, {
            cache: "no-store",
            signal: request.signal,
          }).then(readApiResponse),
        { message: "Membuka rincian cuti & izin..." },
      );
      if (!request.signal.aborted) setDetail(body.data);
    } catch (error) {
      if (!request.signal.aborted) showNotification(normalizeRequestError(error).message, "error");
    } finally {
      requestRef.current = null;
      if (!request.signal.aborted) setOpening(false);
    }
  }
  const rows = leave.recent.filter((row) => tab === "all" || row.status === tab);
  const selectedBalance = leave.balances.find(
    (row) => String(row.id) === String(detail?.leave_type_id),
  );
  return (
    <>
      <DataPanel
        title="Cuti & izin saya"
        description="Lihat lima cuti dan izin terbaru Anda."
        contentSx={{ p: 0 }}
      >
        <Tabs
          value={tab}
          onChange={(_, value) => setTab(value)}
          variant="scrollable"
          scrollButtons="auto"
          aria-label="Status lima cuti dan izin terbaru"
          sx={{ px: 2, borderBottom: "1px solid", borderColor: "divider" }}
        >
          {[
            ["all", "Semua"],
            ["submitted", "Menunggu"],
            ["approved", "Disetujui"],
          ].map(([value, label]) => (
            <Tab
              key={value}
              value={value}
              label={`${label} (${leave.recent.filter((row) => value === "all" || row.status === value).length})`}
            />
          ))}
        </Tabs>
        <Box component="ul" sx={{ p: 0, m: 0, listStyle: "none" }}>
          {rows.map((row) => (
            <Box
              component="li"
              key={row.id}
              sx={{ borderBottom: "1px solid", borderColor: "divider" }}
            >
              <ButtonBase
                disabled={opening}
                onClick={() => openDetail(row.id)}
                aria-label={`Lihat rincian ${row.name} ${row.request_no}`}
                sx={{
                  width: "100%",
                  p: { xs: 2, sm: 3 },
                  gap: 2,
                  textAlign: "left",
                  display: "grid",
                  gridTemplateColumns: "40px minmax(0,1fr) 20px",
                  "&:hover": { bgcolor: theme.ui.panelSubtleBg },
                  "&.Mui-focusVisible": {
                    outline: `2px solid ${theme.palette.primary.main}`,
                    outlineOffset: -2,
                  },
                }}
              >
                <AppIconTile icon="navigation:leave" tone="brand" />
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 1.5,
                    flexWrap: "wrap",
                    minWidth: 0,
                  }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <FontStyle fontSize={14} fontWeight={600} sx={{ overflowWrap: "anywhere" }}>
                      {row.name}
                    </FontStyle>
                    <FontStyle fontSize={12} sx={{ mt: 1, color: "text.secondary" }}>
                      {dayjs(row.start_date).format("D MMM YYYY")} –{" "}
                      {dayjs(row.end_date).format("D MMM YYYY")} · {row.requested_units}{" "}
                      {LEAVE_UNIT[row.unit]}
                    </FontStyle>
                  </Box>
                  <CompactInfoChip
                    label={LEAVE_STATUS[row.status]?.[0]}
                    tone={LEAVE_STATUS[row.status]?.[1]}
                  />
                </Box>
                <Box sx={{ color: "primary.main", display: "flex" }}>
                  <AppIcon icon="action:chevron-right" width={18} />
                </Box>
              </ButtonBase>
            </Box>
          ))}
        </Box>
        {!rows.length ? (
          <FontStyle fontSize={13} sx={{ p: 3, color: "text.secondary", textAlign: "center" }}>
            {leave.recent.length
              ? "Tidak ada cuti atau izin dengan status ini dalam lima data terbaru."
              : "Belum ada cuti atau izin yang tercatat."}
          </FontStyle>
        ) : null}
      </DataPanel>
      <LeaveDetailModal
        item={detail}
        onClose={() => setDetail(null)}
        balance={selectedBalance}
        balanceYear={year}
      />
      <Notification {...notification} onClose={closeNotification} />
    </>
  );
}
