"use client";
import { Button } from "antd";
import AppNotice from "@/app/components/data-display/AppNotice";

const formatDate = (value) =>
  value
    ? new Intl.DateTimeFormat("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(new Date(`${value}T00:00:00`))
    : null;

export default function SubscriptionBanner({
  status,
  endsOn,
  graceEndsOn,
  daysRemaining,
  onRenew,
}) {
  if (!["active", "grace"].includes(status) || daysRemaining == null || daysRemaining > 30) {
    return null;
  }

  const grace = status === "grace";
  const date = formatDate(grace ? graceEndsOn : endsOn);
  const title = grace
    ? date
      ? `Organisasi berada dalam masa tenggang hingga ${date}`
      : "Organisasi berada dalam masa tenggang"
    : date
      ? `Masa akses berakhir ${date}`
      : "Masa akses organisasi segera berakhir";

  return (
    <AppNotice
      tone={grace || daysRemaining <= 7 ? "danger" : "warning"}
      title={title}
      description={`${Math.max(0, daysRemaining)} hari tersisa. Hubungi Superadmin untuk memastikan layanan tetap aktif.`}
      action={<Button onClick={onRenew}>Perpanjang</Button>}
    />
  );
}
