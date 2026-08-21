"use client";

import { Tag } from "antd";
import { useTheme } from "@mui/material/styles";
import {
  CheckCircleFilled,
  ClockCircleFilled,
  CloseCircleFilled,
  ExclamationCircleFilled,
  StopFilled,
} from "@ant-design/icons";

const STATUS = {
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

export default function StatusBadge({ status, label }) {
  const theme = useTheme();
  const config = STATUS[status] || STATUS.inactive;
  const tone = theme.status[config.tone];

  return (
    <Tag
      icon={config.icon}
      style={{
        marginInlineEnd: 0,
        minHeight: 24,
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        paddingInline: 8,
        color: tone.text,
        backgroundColor: tone.background,
        borderColor: tone.border,
        borderRadius: 999,
        fontSize: 11.5,
        fontWeight: 600,
        lineHeight: "22px",
        whiteSpace: "nowrap",
      }}
    >
      {label || config.label}
    </Tag>
  );
}
