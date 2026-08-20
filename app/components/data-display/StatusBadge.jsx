"use client";

import { Tag } from "antd";
import {
  CheckCircleFilled,
  ClockCircleFilled,
  CloseCircleFilled,
  ExclamationCircleFilled,
  StopFilled,
} from "@ant-design/icons";

const STATUS = {
  active: { label: "Aktif", color: "success", icon: <CheckCircleFilled /> },
  inactive: { label: "Nonaktif", color: "default", icon: <StopFilled /> },
  not_started: { label: "Belum mulai", color: "blue", icon: <ClockCircleFilled /> },
  expiring: { label: "Segera berakhir", color: "warning", icon: <ExclamationCircleFilled /> },
  critical: { label: "Kritis", color: "error", icon: <ExclamationCircleFilled /> },
  expired: { label: "Kedaluwarsa", color: "error", icon: <CloseCircleFilled /> },
  ready: { label: "Siap digunakan", color: "success", icon: <CheckCircleFilled /> },
};

export default function StatusBadge({ status, label }) {
  const config = STATUS[status] || STATUS.inactive;
  return (
    <Tag icon={config.icon} color={config.color} style={{ marginInlineEnd: 0, fontWeight: 600 }}>
      {label || config.label}
    </Tag>
  );
}
