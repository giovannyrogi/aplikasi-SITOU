"use client";
import { Tooltip } from "antd";
import StatusBadge from "../data-display/StatusBadge";
export default function SubscriptionStatus({ status, endsOn, graceEndsOn, daysRemaining }) {
  if (!status) return null;
  const finalDate = graceEndsOn || endsOn;
  return (
    <Tooltip
      title={
        finalDate
          ? `Akses sampai ${finalDate}${Number.isFinite(daysRemaining) ? ` (${daysRemaining} hari lagi)` : ""}`
          : "Belum ada periode akses"
      }
    >
      <span>
        <StatusBadge
          status={status}
          label={
            status === "grace"
              ? `Tenggang s.d. ${finalDate}`
              : endsOn
                ? `Aktif s.d. ${endsOn}`
                : undefined
          }
        />
      </span>
    </Tooltip>
  );
}
