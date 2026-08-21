"use client";

import React from "react";
import { Chip, useTheme } from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  CheckCircleFilled,
  ClockCircleFilled,
  CloseCircleFilled,
  ExclamationCircleFilled,
  StopFilled,
} from "@ant-design/icons";

const STATUS_CONFIG = {
  active: { label: "Aktif", tone: "success", icon: <CheckCircleFilled /> },
  grace: { label: "Masa tenggang", tone: "warning", icon: <ExclamationCircleFilled /> },
  scheduled: { label: "Terjadwal", tone: "info", icon: <ClockCircleFilled /> },
  suspended: { label: "Ditangguhkan", tone: "danger", icon: <StopFilled /> },
  cancelled: { label: "Dibatalkan", tone: "neutral", icon: <CloseCircleFilled /> },
  no_subscription: {
    label: "Belum berlangganan",
    tone: "neutral",
    icon: <ExclamationCircleFilled />,
  },
  inactive: { label: "Nonaktif", tone: "danger", icon: <StopFilled /> },
  not_started: { label: "Belum mulai", tone: "info", icon: <ClockCircleFilled /> },
  expiring: { label: "Segera berakhir", tone: "warning", icon: <ExclamationCircleFilled /> },
  critical: { label: "Kritis", tone: "danger", icon: <ExclamationCircleFilled /> },
  expired: { label: "Kedaluwarsa", tone: "danger", icon: <CloseCircleFilled /> },
  ready: { label: "Siap digunakan", tone: "success", icon: <CheckCircleFilled /> },
};

/**
 * Chip tunggal untuk metadata dan status agar warna, ikon, tinggi, dan baseline konsisten.
 */
export default function CompactInfoChip({ label, status, tone, color, icon, sx }) {
  const theme = useTheme();
  const statusConfig = STATUS_CONFIG[status];
  const toneConfig = theme.status[tone || statusConfig?.tone];
  const resolvedColor = color || toneConfig?.main || theme.palette.primary.main;
  const resolvedText = toneConfig?.text || resolvedColor;
  const resolvedBackground = toneConfig?.background || alpha(resolvedColor, 0.09);
  const resolvedBorder = toneConfig?.border || alpha(resolvedColor, 0.24);

  return (
    <Chip
      size="small"
      label={label || statusConfig?.label || "-"}
      icon={icon || statusConfig?.icon}
      sx={{
        height: 24,
        maxWidth: "100%",
        flexShrink: 0,
        borderRadius: 999,
        color: resolvedText,
        bgcolor: resolvedBackground,
        border: `1px solid ${resolvedBorder}`,
        "& .MuiChip-icon": {
          ml: 0.75,
          mr: -0.25,
          color: "inherit",
          fontSize: 13,
        },
        "& .MuiChip-label": {
          px: 1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          fontSize: 11.5,
          fontWeight: 600,
          lineHeight: 1,
        },
        ...sx,
      }}
    />
  );
}
