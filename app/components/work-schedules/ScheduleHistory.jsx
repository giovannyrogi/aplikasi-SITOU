"use client";

import dayjs from "dayjs";
import { Box } from "@mui/material";
import { Button } from "antd";
import FontStyle from "@/app/components/font-style/FontStyle";
import CompactInfoChip from "@/app/components/chips/CompactInfoChip";
import EmptyState from "@/app/components/data-display/EmptyState";
import { InfoField, InfoFieldGrid } from "@/app/components/employees/EmployeeDetailSections";

const dateLabel = (value) => (value ? dayjs(value).format("D MMMM YYYY") : "Sampai diganti");

/** Riwayat hanya menyajikan fakta penetapan yang dikembalikan server. */
export default function ScheduleHistory({ assignments = [], today, timezone, manage, onCancel }) {
  if (!assignments.length)
    return <EmptyState description="Belum ada jadwal yang ditetapkan untuk Pegawai ini." />;
  return (
    <Box component="ol" sx={{ m: 0, p: 0, listStyle: "none", display: "grid", gap: 3 }}>
      {assignments.map((assignment) => {
        const upcoming = Boolean(today && assignment.from > today);
        const ended = Boolean(today && assignment.until && assignment.until < today);
        const status = assignment.cancelled
          ? ["Dibatalkan", "danger"]
          : !today
            ? ["Jadwal tersimpan", "neutral"]
            : upcoming
              ? ["Belum berlaku", "info"]
              : ended
                ? ["Sudah berakhir", "neutral"]
                : ["Sedang berlaku", "success"];
        const createdAt = assignment.createdAt ? new Date(assignment.createdAt) : null;
        const savedAt =
          createdAt && !Number.isNaN(createdAt.getTime())
            ? new Intl.DateTimeFormat("id-ID", {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: timezone,
              }).format(createdAt)
            : "Tidak tersedia";
        return (
          <Box
            component="li"
            key={assignment.id}
            sx={{
              p: { xs: 2, sm: 3 },
              border: 1,
              borderColor: "divider",
              borderRadius: 2,
              display: "grid",
              gap: 3,
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 1.5,
              }}
            >
              <FontStyle fontSize={15} fontWeight={700} sx={{ overflowWrap: "anywhere" }}>
                {assignment.patternName}
              </FontStyle>
              <CompactInfoChip label={status[0]} tone={status[1]} />
            </Box>
            <InfoFieldGrid
              items={[
                ["Mulai berlaku", dateLabel(assignment.from)],
                ["Berlaku sampai", dateLabel(assignment.until)],
                ["Ditetapkan oleh", assignment.createdBy || "Tidak tersedia"],
                ["Disimpan pada", savedAt],
              ]}
            />
            <InfoField
              label="Alasan penetapan"
              value={assignment.reason || "Tidak ada alasan yang tercatat."}
              readable
            />
            {assignment.cancelled && (
              <InfoField
                label="Alasan pembatalan"
                value={assignment.cancellationReason || "Tidak ada alasan yang tercatat."}
                readable
              />
            )}
            {manage && !assignment.cancelled && upcoming && (
              <Box sx={{ pt: 2, borderTop: 1, borderColor: "divider" }}>
                <Button
                  danger
                  onClick={() => onCancel(assignment)}
                  style={{ minHeight: 44, height: "auto", maxWidth: "100%", whiteSpace: "normal" }}
                >
                  Batalkan penetapan
                </Button>
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
