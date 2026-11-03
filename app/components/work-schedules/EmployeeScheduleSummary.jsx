"use client";

import { Box } from "@mui/material";
import dayjs from "dayjs";
import AppIconTile from "@/app/components/icons/AppIconTile";
import CompactInfoChip from "@/app/components/chips/CompactInfoChip";
import FontStyle from "@/app/components/font-style/FontStyle";

/** Same assignment facts and presentation in desktop cells and mobile cards. */
export default function EmployeeScheduleSummary({ assignments, today, error }) {
  if (!today)
    return (
      <FontStyle fontSize={14} color="text.secondary">
        {error ? "Jadwal belum dapat ditampilkan." : "Memuat jadwal..."}
      </FontStyle>
    );
  const available = (assignments || []).filter((assignment) => !assignment.cancelled);
  const current = available.find(
    (assignment) => assignment.from <= today && (!assignment.until || assignment.until >= today),
  );
  const upcoming = available
    .filter((assignment) => assignment.from > today)
    .sort((a, b) => a.from.localeCompare(b.from))[0];
  const schedule = current || upcoming;
  if (!schedule)
    return (
      <Box sx={{ display: "flex", minWidth: 0 }}>
        <CompactInfoChip label="Belum diatur" tone="warning" wrap />
      </Box>
    );
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
      <AppIconTile
        icon="solar:calendar-date-bold-duotone"
        tone={current ? "success" : "info"}
        size={32}
        iconSize={18}
      />
      <Box sx={{ minWidth: 0, display: "grid", gap: 0.75 }}>
        <FontStyle fontSize={14} fontWeight={500}>
          {schedule.patternName}
        </FontStyle>
        {!current && (
          <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
            <CompactInfoChip label="Belum mulai" tone="info" wrap />
            <FontStyle fontSize={13} color="text.secondary">
              Mulai {dayjs(upcoming.from).format("D MMM YYYY")}
            </FontStyle>
          </Box>
        )}
      </Box>
    </Box>
  );
}
