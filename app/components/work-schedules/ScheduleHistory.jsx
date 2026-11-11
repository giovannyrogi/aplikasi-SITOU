"use client";

import dayjs from "dayjs";
import { useState } from "react";
import { Box } from "@mui/material";
import { Button } from "antd";
import FontStyle from "@/app/components/font-style/FontStyle";
import CompactInfoChip from "@/app/components/chips/CompactInfoChip";
import EmptyState from "@/app/components/data-display/EmptyState";
import AppCollapse from "@/app/components/data-display/AppCollapse";
import DataPagination from "@/app/components/data-display/DataPagination";
import AppModal from "@/app/components/modals/AppModal";
import { InfoField, InfoFieldGrid } from "@/app/components/employees/EmployeeDetailSections";

const dateLabel = (value) => dayjs(value).format("D MMM YYYY");
const PAGE_SIZE = 5;

/** Riwayat hanya menyajikan fakta penetapan yang dikembalikan server. */
export default function ScheduleHistory({
  employeeIdentity,
  assignments = [],
  today,
  timezone,
  manage,
  onCancel,
  onClose,
}) {
  const [page, setPage] = useState(1);
  const [expandedKey, setExpandedKey] = useState(null);
  const start = (page - 1) * PAGE_SIZE;
  const visibleAssignments = assignments.slice(start, start + PAGE_SIZE);
  const items = visibleAssignments.map((assignment) => {
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
    return {
      key: assignment.id,
      label: (
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
            <FontStyle
              fontSize={15}
              fontWeight={600}
              sx={{ flexGrow: 1, overflowWrap: "anywhere" }}
            >
              {assignment.patternName}
            </FontStyle>
            <CompactInfoChip label={status[0]} tone={status[1]} />
          </Box>
          <FontStyle fontSize={13} color="text.secondary" sx={{ mt: 0.5 }}>
            {assignment.until
              ? `${dateLabel(assignment.from)} – ${dateLabel(assignment.until)}`
              : `${dateLabel(assignment.from)} · Sampai diganti`}
          </FontStyle>
        </Box>
      ),
      children: (
        <Box sx={{ display: "grid", gap: 2, minWidth: 0 }}>
          <InfoFieldGrid
            items={[
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
      ),
    };
  });
  return (
    <AppModal
      open
      title="Riwayat jadwal"
      description="Buka jadwal untuk melihat rincian penetapannya."
      descriptionAlign="left"
      onClose={onClose}
      contentResetKey={page}
      footer={<Button onClick={onClose}>Tutup</Button>}
      pagination={
        assignments.length > PAGE_SIZE && (
          <DataPagination
            pagination={{ page, pageSize: PAGE_SIZE, total: assignments.length }}
            onPageChange={(nextPage) => {
              setExpandedKey(null);
              setPage(nextPage);
            }}
            pageSizeOptions={[]}
            ariaLabel="Navigasi riwayat jadwal"
            summary={`${start + 1}–${start + visibleAssignments.length} dari ${assignments.length} penetapan`}
          />
        )
      }
    >
      <Box sx={{ display: "grid", gap: 3, minWidth: 0 }}>
        <Box sx={{ pb: 3, borderBottom: 1, borderColor: "divider" }}>
          <InfoField label="Pegawai" valueContent={employeeIdentity} />
        </Box>
        {items.length ? (
          <AppCollapse
            items={items}
            activeKey={expandedKey ? [expandedKey] : []}
            onChange={(keys) => setExpandedKey(keys.at(-1) ?? null)}
            expandIconPlacement="end"
          />
        ) : (
          <EmptyState description="Belum ada jadwal yang ditetapkan untuk Pegawai ini." />
        )}
      </Box>
    </AppModal>
  );
}
