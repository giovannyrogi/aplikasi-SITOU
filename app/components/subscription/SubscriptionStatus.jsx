"use client";
import { Tooltip } from "antd";
import CompactInfoChip from "../chips/CompactInfoChip";
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
        <CompactInfoChip
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
