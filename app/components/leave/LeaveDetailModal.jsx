"use client";
import { Button } from "antd";
import { FileSearchOutlined } from "@ant-design/icons";
import { Box, Divider, useTheme } from "@mui/material";
import AppModal from "@/app/components/modals/AppModal";
import CompactInfoChip from "@/app/components/chips/CompactInfoChip";
import FontStyle from "@/app/components/font-style/FontStyle";
import {
  LEAVE_CATEGORY,
  LEAVE_SOURCE,
  LEAVE_STATUS,
  LEAVE_UNIT,
  formatLeaveDate,
  formatLeaveUnits,
} from "./leaveLabels";
const Field = ({ label, value, wide }) => (
  <Box sx={{ gridColumn: wide ? "1 / -1" : undefined, minWidth: 0 }}>
    <FontStyle fontSize={11} sx={{ color: "text.secondary" }}>
      {label}
    </FontStyle>
    <FontStyle
      fontSize={13}
      fontWeight={600}
      sx={{ mt: 0.4, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
    >
      {value || "-"}
    </FontStyle>
  </Box>
);
export default function LeaveDetailModal({ item, onClose }) {
  const theme = useTheme();
  if (!item) return null;
  const status = LEAVE_STATUS[item.status] || [item.status, "neutral"];
  const category = LEAVE_CATEGORY[item.category] || [item.category, "neutral"];
  return (
    <AppModal
      open
      title="Detail cuti & izin"
      description={`${item.request_no} · ${item.full_name}`}
      icon="solar:calendar-search-bold-duotone"
      size="lg"
      onClose={onClose}
      footer={<Button onClick={onClose}>Tutup</Button>}
    >
      <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", mb: 2 }}>
        <CompactInfoChip label={status[0]} tone={status[1]} />
        <CompactInfoChip label={category[0]} tone={category[1]} />
        <CompactInfoChip label={LEAVE_SOURCE[item.submission_source]} />
      </Box>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
          gap: 2,
          p: 2,
          bgcolor: theme.ui.panelSubtleBg,
          border: `1px solid ${theme.ui.panelBorderSubtle}`,
          borderRadius: 2,
        }}
      >
        <Field label="Pegawai" value={`${item.employee_no} - ${item.full_name}`} />
        <Field label="Jenis" value={item.leave_type_name} />
        <Field
          label="Periode"
          value={`${formatLeaveDate(item.start_date)} - ${formatLeaveDate(item.end_date)}`}
        />
        <Field
          label="Durasi"
          value={`${formatLeaveUnits(item.requested_units)} ${LEAVE_UNIT[item.unit]}`}
        />
        <Field
          label="Penempatan saat mulai"
          value={
            [item.position_name, item.organization_unit_name, item.location_name]
              .filter(Boolean)
              .join(" · ") || "Belum ada penempatan"
          }
          wide
        />
        <Field label="Alasan" value={item.reason} wide />
      </Box>
      <Divider sx={{ my: 2 }} />
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
        <Field label="Dicatat oleh" value={item.created_by_name} />
        <Field
          label="Waktu pencatatan"
          value={item.created_at ? new Date(item.created_at).toLocaleString("id-ID") : "-"}
        />
        <Field label="Diputuskan oleh" value={item.decided_by_name} />
        <Field
          label="Waktu keputusan"
          value={item.decided_at ? new Date(item.decided_at).toLocaleString("id-ID") : "-"}
        />
        <Field label="Catatan keputusan" value={item.decision_notes} wide />
        {item.status === "cancelled" ? (
          <>
            <Field label="Dibatalkan oleh" value={item.cancelled_by_name} />
            <Field
              label="Waktu pembatalan"
              value={item.cancelled_at ? new Date(item.cancelled_at).toLocaleString("id-ID") : "-"}
            />
            <Field label="Alasan pembatalan" value={item.cancellation_reason} wide />
          </>
        ) : null}
      </Box>
      {item.attachments?.length ? (
        <>
          <Divider sx={{ my: 2 }} />
          <FontStyle fontSize={13} fontWeight={700}>
            Lampiran privat
          </FontStyle>
          <Box sx={{ mt: 1, display: "flex", gap: 1, flexWrap: "wrap" }}>
            {item.attachments.map((file, index) => (
              <Button
                key={file.id}
                icon={<FileSearchOutlined />}
                href={`/api/uploads/${file.id}?organizationId=${item.organization_id}`}
                target="_blank"
              >
                Lihat lampiran {index + 1}
              </Button>
            ))}
          </Box>
        </>
      ) : null}
    </AppModal>
  );
}
