"use client";

import { Alert, Button } from "antd";
export default function SubscriptionBanner({ activeUntil, daysRemaining, onRenew }) {
  if (daysRemaining == null || daysRemaining > 30) return null;
  return (
    <Alert
      showIcon
      type={daysRemaining <= 7 ? "error" : "warning"}
      message={`Masa akses berakhir ${activeUntil}`}
      description={`${Math.max(0, daysRemaining)} hari tersisa. Hubungi Superadmin untuk memastikan layanan tetap aktif.`}
      action={<Button onClick={onRenew}>Perpanjang</Button>}
    />
  );
}
