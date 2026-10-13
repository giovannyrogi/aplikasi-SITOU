"use client";

import { Box, useTheme } from "@mui/material";
import AppIconTile from "@/app/components/icons/AppIconTile";
import FontStyle from "@/app/components/font-style/FontStyle";

/** Angka stok dengan ikon dan label terpisah agar tetap terbaca tanpa chip. */
export default function InventoryStockMetric({ label, value, unit, icon, tone = "info", prominent = false }) {
  const theme = useTheme();
  const brandIcon = tone === "brand";
  const color = theme.status[tone] || theme.status.neutral;

  return <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0 }}>
    <AppIconTile icon={icon} tone={tone} size={prominent ? 40 : 36} iconSize={prominent ? 20 : 18}/>
    <Box sx={{ minWidth: 0 }}>
      <FontStyle fontSize={11.5} fontWeight={600} sx={{ color: "text.secondary", lineHeight: 1.4 }}>
        {label}
      </FontStyle>
      <FontStyle fontSize={prominent ? 15 : 13.5} fontWeight={700}
        sx={{ color: prominent || brandIcon ? "text.primary" : color.text, lineHeight: 1.4, overflowWrap: "anywhere" }}>
        {value} {unit}
      </FontStyle>
    </Box>
  </Box>;
}
