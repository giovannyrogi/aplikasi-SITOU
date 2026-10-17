"use client";

import { Box, Button, useTheme } from "@mui/material";
import FontStyle from "../font-style/FontStyle";
import AppIconTile from "../icons/AppIconTile";
import CompactInfoChip from "../chips/CompactInfoChip";

const formatDate = (value) =>
  value
    ? new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(
        new Date(`${value}T00:00:00`),
      )
    : "Belum tersedia";

/** Masa akses organisasi, bukan masa kontrak atau masa sesi pengguna. */
export default function SubscriptionAccessCard({ user, onRenew }) {
  const theme = useTheme();
  if (!user?.organization_id) return null;
  const status = user.organization_subscription_status;
  const grace = status === "grace";
  const days = user.organization_days_remaining;
  const end = grace
    ? user.organization_subscription_grace_ends_on || user.organization_subscription_ends_on
    : user.organization_subscription_ends_on;
  const tone =
    grace || (Number.isFinite(days) && days <= 7)
      ? "danger"
      : Number.isFinite(days) && days <= 30
        ? "warning"
        : "success";
  return (
    <Box
      component="section"
      aria-label="Masa akses organisasi"
      sx={{
        p: 1.5,
        borderRadius: 3,
        border: "1px solid",
        borderColor: theme.ui.navUserBorder,
        bgcolor: theme.ui.panelAccentBg,
        boxShadow: theme.ui.navUserShadow,
      }}
    >
      <Box sx={{ display: "flex", gap: 1, alignItems: "center", justifyContent: "space-between" }}>
        <Box sx={{ display: "flex", gap: 1, alignItems: "center", minWidth: 0 }}>
          <AppIconTile icon="subscription:access" size={30} iconSize={18} />
          <FontStyle fontSize={12} fontWeight={700}>
            Masa akses SITOU
          </FontStyle>
        </Box>
        <CompactInfoChip
          label={grace ? "Tenggang" : status === "active" ? "Aktif" : "Belum tersedia"}
          tone={tone}
        />
      </Box>
      <Box
        sx={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 0.5,
          mt: 1.25,
        }}
      >
        <FontStyle fontSize={12} fontWeight={600}>
          {formatDate(end)}
        </FontStyle>
        {Number.isFinite(days) ? (
          <FontStyle fontSize={11} fontWeight={600} sx={{ color: theme.status[tone].text }}>
            {days < 0 ? "Telah berakhir" : days === 0 ? "Berakhir hari ini" : `${days} hari lagi`}
          </FontStyle>
        ) : null}
      </Box>
      <Button fullWidth variant="contained" onClick={onRenew} sx={{ mt: 1.5, minHeight: 44 }}>
        Perpanjang akses
      </Button>
    </Box>
  );
}
