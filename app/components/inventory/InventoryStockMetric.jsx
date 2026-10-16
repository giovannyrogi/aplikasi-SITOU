"use client";

import { Box, useTheme } from "@mui/material";
import AppIconTile from "@/app/components/icons/AppIconTile";
import FontStyle from "@/app/components/font-style/FontStyle";

/** Angka stok dengan ikon dan label terpisah agar tetap terbaca tanpa chip. */
export default function InventoryStockMetric({ label, value, unit, icon, tone = "info" }) {
  const theme = useTheme();
  const color = theme.status[tone] || theme.status.neutral;
  const valueColor = tone === "brand" ? theme.palette.primary.main
    : tone === "secondary" ? theme.palette.secondary.main : color.text;

  return <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0 }}>
    <AppIconTile icon={icon} tone={tone} size={36} iconSize={18}/>
    <Box sx={{ minWidth: 0 }}>
      <FontStyle fontSize={11.5} fontWeight={600} sx={{ color: "text.secondary", lineHeight: 1.4 }}>
        {label}
      </FontStyle>
      <FontStyle fontSize={13.5} fontWeight={700}
        sx={{ color: valueColor, lineHeight: 1.4, overflowWrap: "anywhere" }}>
        {value} {unit}
      </FontStyle>
    </Box>
  </Box>;
}
