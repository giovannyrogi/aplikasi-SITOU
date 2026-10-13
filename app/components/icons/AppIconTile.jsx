"use client";

import { Box, useTheme } from "@mui/material";
import { alpha } from "@mui/material/styles";
import AppIcon from "./AppIcon";

/** Latar ikon dekoratif dengan intensitas warna yang konsisten untuk setiap tone. */
export default function AppIconTile({ icon, tone = "brand", size = 40, iconSize = 20,
  borderRadius = 1.5, showBorder = false, sx, ...props }) {
  const theme = useTheme();
  const color = tone === "brand" ? theme.brand.primary
    : tone === "secondary" ? theme.palette.secondary.main
      : (theme.status[tone] || theme.status.neutral).main;

  return <Box aria-hidden="true" {...props} sx={{
    width: size, height: size, flex: `0 0 ${size}px`, display: "grid", placeItems: "center",
    borderRadius, color, bgcolor: alpha(color, 0.12),
    ...(showBorder ? { border: `1px solid ${alpha(color, 0.3)}` } : {}),
    ...sx,
  }}>
    {typeof icon === "string" ? <AppIcon icon={icon} width={iconSize}/> : icon}
  </Box>;
}
