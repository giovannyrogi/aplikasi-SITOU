"use client";

import { useId, useState } from "react";
import { Box } from "@mui/material";
import { Button, Popover } from "antd";
import CompactInfoChip from "@/app/components/chips/CompactInfoChip";
import FontStyle from "@/app/components/font-style/FontStyle";
import {
  attendanceIndicator,
  attendanceIndicatorLabel,
  attendanceMissingLabel,
  ATTENDANCE_STATUS,
} from "@/lib/reports/attendancePresentation.mjs";

const priority = [
  "outside_radius",
  "outside_schedule",
  "needs_review",
  "incomplete",
  "late_check_in",
  "early_check_out",
  "holiday_work",
  "near_boundary",
];

export function AttendanceIndicators({ indicators, lateMinutes, compact = false }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const ordered = compact
    ? [...new Set([...priority.filter((key) => indicators.includes(key)), ...indicators])]
    : [...new Set(indicators)];
  const items = ordered.map((key) => [key, attendanceIndicator(key)]).filter(([, item]) => item);
  if (!items.length) return null;
  const chips = (entries, wrap) =>
    entries.map(([key, [, tone]]) => (
      <CompactInfoChip
        key={key}
        label={attendanceIndicatorLabel(key, lateMinutes)}
        tone={tone}
        wrap={wrap}
        sx={wrap ? undefined : { minWidth: 0, flexShrink: 1 }}
      />
    ));
  const remaining = items.length - 1;
  return (
    <Box
      sx={{
        display: "flex",
        flexWrap: compact ? "nowrap" : "wrap",
        alignItems: "center",
        gap: 0.75,
        minWidth: 0,
      }}
    >
      {compact ? chips(items.slice(0, 1), false) : chips(items, true)}
      {compact && remaining > 0 && (
        <Popover
          trigger="click"
          placement="bottomRight"
          open={open}
          onOpenChange={setOpen}
          content={
            <Box
              id={id}
              role="region"
              aria-label="Indikator lainnya"
              sx={{
                display: "flex",
                flexWrap: "wrap",
                gap: 0.75,
                maxWidth: "min(280px, calc(100vw - 64px))",
              }}
            >
              {chips(items.slice(1), true)}
            </Box>
          }
        >
          <Button
            type="text"
            aria-label={`Lihat ${remaining} indikator lainnya`}
            aria-expanded={open}
            aria-controls={open ? id : undefined}
            style={{ minWidth: 44, height: 44, flexShrink: 0 }}
            onKeyDown={(event) => {
              if (event.key === "Escape") setOpen(false);
            }}
          >
            +{remaining}
          </Button>
        </Popover>
      )}
    </Box>
  );
}

export function AttendanceState({ row, chip = false }) {
  const [label, tone] = ATTENDANCE_STATUS[row.attendance_status] || [
    "Status belum tersedia",
    "neutral",
  ];
  const missingLabel = attendanceMissingLabel(row);
  if (chip) {
    return (
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
        <CompactInfoChip label={missingLabel || label} tone={missingLabel ? "warning" : tone} wrap />
        {missingLabel && row.attendance_status !== "incomplete" && (
          <CompactInfoChip label={label} tone={tone} wrap />
        )}
      </Box>
    );
  }
  return (
    <Box>
      <FontStyle
        fontSize={13}
        fontWeight={600}
        sx={{ color: (theme) => theme.status[missingLabel ? "warning" : tone].text }}
      >
        {missingLabel || label}
      </FontStyle>
      {missingLabel && row.attendance_status !== "incomplete" && (
        <FontStyle fontSize={12} sx={{ color: (theme) => theme.status[tone].text }}>
          {label}
        </FontStyle>
      )}
    </Box>
  );
}
