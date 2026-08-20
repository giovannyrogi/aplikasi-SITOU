"use client";

import { Tooltip } from "antd";
import StatusBadge from "../data-display/StatusBadge";
export default function SubscriptionStatus({ status, activeUntil, daysRemaining }) {
  if (!activeUntil) return null;
  return (
    <Tooltip
      title={`Masa akses berakhir ${activeUntil}${Number.isFinite(daysRemaining) ? ` (${daysRemaining} hari lagi)` : ""}`}
    >
      <span>
        <StatusBadge status={status} label={`Aktif s.d. ${activeUntil}`} />
      </span>
    </Tooltip>
  );
}
