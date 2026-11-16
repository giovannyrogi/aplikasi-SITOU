"use client";

import { useState } from "react";
import { Box, ButtonBase, Tooltip } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { Button } from "antd";
import {
  CalendarOutlined,
  ClockCircleOutlined,
  EnvironmentOutlined,
  ExclamationCircleOutlined,
  FlagOutlined,
  LogoutOutlined,
} from "@ant-design/icons";
import AppModal from "@/app/components/modals/AppModal";
import AppIconTile from "@/app/components/icons/AppIconTile";
import FontStyle from "@/app/components/font-style/FontStyle";
import CompactInfoChip from "@/app/components/chips/CompactInfoChip";
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

const indicatorIcons = {
  early_check_out: LogoutOutlined,
  outside_radius: ExclamationCircleOutlined,
  near_boundary: EnvironmentOutlined,
  holiday_work: CalendarOutlined,
  outside_schedule: CalendarOutlined,
  incomplete: FlagOutlined,
  needs_review: FlagOutlined,
};

export function attendanceIndicatorIcon(key) {
  return indicatorIcons[key] || ClockCircleOutlined;
}

export function attendanceIndicatorIconTone(tone) {
  return tone === "neutral" || tone === "holidayWork" ? "info" : tone;
}

export function AttendanceIndicators({ indicators, metrics, context }) {
  const [open, setOpen] = useState(false);
  const items = [...new Set([...priority.filter((key) => indicators.includes(key)), ...indicators])]
    .filter((key) => attendanceIndicator(key))
    .map((key) => {
      const [label, tone] = attendanceIndicator(key);
      return { key, label, tone, detail: attendanceIndicatorLabel(key, metrics) };
    });
  const [primary] = items;
  if (!primary) return null;
  const remaining = items.length - 1;

  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 0.75, minWidth: 0 }}>
      <CompactInfoChip
        label={remaining ? primary.label : primary.detail}
        tone={primary.tone}
        wrap
      />
      {remaining > 0 && (
        <>
          <Tooltip title={`${remaining} indikator lainnya`} describeChild>
            <ButtonBase
              type="button"
              aria-label={`Lihat ${remaining} indikator tambahan, ${context}`}
              aria-haspopup="dialog"
              aria-expanded={open}
              onClick={() => setOpen(true)}
              sx={(theme) => ({
                minWidth: 44,
                minHeight: 44,
                borderRadius: 999,
                "&:hover .MuiChip-root": {
                  background: alpha(theme.palette.primary.main, 0.19),
                  borderColor: "primary.main",
                },
                "&.Mui-focusVisible": { outline: "2px solid", outlineColor: "primary.main" },
              })}
            >
              <CompactInfoChip
                component="span"
                label={`+${remaining}`}
                sx={{
                  color: "primary.dark",
                  background: (theme) =>
                    `linear-gradient(150deg, ${theme.palette.background.paper}, ${alpha(theme.palette.primary.main, 0.16)})`,
                  borderColor: (theme) => alpha(theme.palette.primary.main, 0.35),
                  boxShadow: (theme) => `0 2px 5px ${alpha(theme.palette.primary.dark, 0.16)}`,
                  "& .MuiChip-label": { fontWeight: 700 },
                }}
              />
            </ButtonBase>
          </Tooltip>
          <AppModal
            open={open}
            title="Indikator absensi"
            description={context}
            descriptionAlign="left"
            icon="navigation:work-schedules"
            width={420}
            onClose={() => setOpen(false)}
            footer={<Button onClick={() => setOpen(false)}>Tutup</Button>}
          >
            <Box
              component="ul"
              sx={{
                listStyle: "none",
                m: 0,
                p: 0,
                display: "grid",
                gap: 1.25,
              }}
            >
              {items.map(({ key, label, detail, tone }) => {
                const Icon = attendanceIndicatorIcon(key);
                const value = detail === label ? null : detail.slice(label.length).trim();
                return (
                  <Box
                    component="li"
                    key={key}
                    sx={(theme) => {
                      const tint = (theme.status[tone] || theme.status.neutral).main;
                      return {
                        display: "flex",
                        alignItems: "center",
                        gap: 1.5,
                        p: 1.5,
                        minWidth: 0,
                        border: 1,
                        borderColor: alpha(tint, 0.24),
                        borderRadius: 2.5,
                        background: `linear-gradient(135deg, ${alpha(tint, 0.075)}, ${theme.palette.background.paper})`,
                        boxShadow: "0 3px 8px rgba(16, 30, 53, 0.08)",
                      };
                    }}
                  >
                    <AppIconTile
                      tone={attendanceIndicatorIconTone(tone)}
                      icon={<Icon />}
                      size={36}
                      showBorder
                      sx={{ boxShadow: 1 }}
                    />
                    <Box sx={{ minWidth: 0 }}>
                      <FontStyle
                        component="div"
                        fontSize={14}
                        fontWeight={700}
                        sx={{ color: (theme) => (theme.status[tone] || theme.status.neutral).text }}
                      >
                        {label}
                      </FontStyle>
                      {value && (
                        <FontStyle component="div" fontSize={13} color="text.secondary">
                          {value}
                        </FontStyle>
                      )}
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </AppModal>
        </>
      )}
    </Box>
  );
}

export function AttendanceState({ row }) {
  const [label, tone] = ATTENDANCE_STATUS[row.attendance_status] || [
    "Status belum tersedia",
    "neutral",
  ];
  const missingLabel = attendanceMissingLabel(row);
  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, minWidth: 0 }}>
      <CompactInfoChip label={missingLabel || label} tone={missingLabel ? "warning" : tone} wrap />
      {missingLabel && row.attendance_status !== "incomplete" && (
        <CompactInfoChip label={label} tone={tone} wrap />
      )}
    </Box>
  );
}
